"""Fiches de révision: upload (multipart), listing, inline preview, download, delete.

Files live on disk in backend/uploads/ (uuid names, never user input in a path);
metadata lives in Mongo. Toutes les routes exigent une session (compte étudiant).
"""

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import FileResponse, Response
from pymongo import DESCENDING

from lib.db import db
from lib.docx_html import docx_to_html
from lib.extract import READ_CHARS, extract_text
from lib.flashcards import build_deck_for_sheet
from lib.storage import get_object, object_path, put_object
from models.sheet import (
    DOMAINS,
    Sheet,
    SheetDiseaseLink,
    SheetFavorite,
    SheetOut,
    SheetReport,
    SheetReportOut,
    SheetHtml,
    SheetReportRequest,
    SheetText,
)
from routers.auth import COOKIE_NAME, current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sheets"])

MAX_SIZE = 50 * 1024 * 1024  # 50 Mo (cours volumineux : diaporamas convertis, scans)
ALLOWED_EXTS = {"pdf", "png", "jpg", "jpeg", "docx", "txt"}
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MIME_BY_EXT = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "docx": DOCX_MIME,
    "txt": "text/plain",
}
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
# Images extraites des DOCX : cache régénérable (le DOCX reste la source durable).
MEDIA_DIR = UPLOADS_DIR / "media"
CHUNK = 1024 * 1024

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


async def ensure_local_file(doc: dict) -> Path | None:
    """Chemin local du fichier, restauré depuis le stockage objet si le disque l'a perdu.

    Le disque du conteneur est éphémère (redéploiement = disque vide) : le stockage objet
    est la copie durable, `uploads/` n'est qu'un cache.
    """
    path = UPLOADS_DIR / doc["stored_name"]
    if path.is_file():
        return path
    remote = doc.get("storage_path") or object_path(doc["stored_name"])
    try:
        data = await get_object(remote)
    except Exception:  # stockage indisponible → 404 propre, jamais un 500
        return None
    if data is None:
        return None
    path.write_bytes(data)
    return path


async def migrate_local_files_to_storage() -> int:
    """Pousse dans le stockage objet les fiches encore seulement sur disque (une fois).

    Best-effort et idempotent : au prochain démarrage il ne reste plus rien à migrer.
    """
    migrated = 0
    docs = await db.sheets.find({"storage_path": {"$in": [None, ""]}}).to_list(2000)
    for doc in docs:
        path = UPLOADS_DIR / doc.get("stored_name", "")
        if not doc.get("stored_name") or not path.is_file():
            continue
        try:
            remote = await put_object(
                object_path(doc["stored_name"]),
                path.read_bytes(),
                doc.get("mime") or "application/octet-stream",
            )
        except Exception as exc:
            logger.warning("migration stockage %s: %s", doc.get("id"), exc)
            continue
        await db.sheets.update_one({"id": doc["id"]}, {"$set": {"storage_path": remote}})
        migrated += 1
    if migrated:
        logger.info("migration stockage: %d fiche(s) copiée(s)", migrated)
    return migrated


async def _find_or_404(sheet_id: str) -> dict:
    doc = await db.sheets.find_one({"id": sheet_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Fiche introuvable")
    return doc


@router.get("/sheets", response_model=list[SheetOut])
async def list_sheets(domain: str | None = None, _: dict = Depends(current_user)):
    query: dict = {}
    if domain is not None:
        if domain not in DOMAINS:
            raise HTTPException(status_code=422, detail="Domaine inconnu")
        query["domain"] = domain
    docs = await db.sheets.find(query).sort("created_at", DESCENDING).limit(500).to_list(500)
    # Lecteurs distincts par fiche : une seule agrégation pour toute la liste.
    viewers = {
        row["_id"]: row["n"]
        async for row in db.sheet_views.aggregate(
            [{"$group": {"_id": "$sheet_id", "n": {"$sum": 1}}}]
        )
    }
    return [
        SheetOut.from_doc({**doc, "viewers": viewers.get(doc["id"], 0)}) for doc in docs
    ]


@router.post("/sheets", response_model=SheetOut, status_code=201)
async def upload_sheet(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(min_length=1, max_length=200),
    domain: str = Form(),
    description: str = Form(default="", max_length=500),
    unit: str = Form(default="", max_length=40),
    user: dict = Depends(current_user),
):
    title = title.strip()
    description = description.strip()
    unit = unit.strip()[:40]
    if not title:
        raise HTTPException(status_code=422, detail="Le titre est obligatoire")
    if domain not in DOMAINS:
        raise HTTPException(status_code=422, detail="Domaine inconnu")

    original = file.filename or "fiche.txt"
    ext = original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=422, detail="Format non autorisé (pdf, png, jpg, docx, txt)")

    # Stream in chunks so a 10 Mo upload never sits whole in memory.
    size = 0
    chunks: list[bytes] = []
    while chunk := await file.read(CHUNK):
        size += len(chunk)
        if size > MAX_SIZE:
            raise HTTPException(status_code=413, detail="Fichier trop lourd (50 Mo max)")
        chunks.append(chunk)

    stored_name = f"{uuid.uuid4().hex}.{ext}"
    path = UPLOADS_DIR / stored_name
    data = b"".join(chunks)
    path.write_bytes(data)  # cache local, pour l'extraction et les lectures suivantes

    # Copie durable : sans elle, la fiche disparaîtrait au prochain redéploiement.
    try:
        storage_path = await put_object(object_path(stored_name), data, MIME_BY_EXT[ext])
    except Exception as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=502, detail="Stockage indisponible — réessaie dans un instant"
        ) from exc

    # L'auteur est le titulaire du compte — plus de saisie libre du nom.
    sheet = Sheet(
        title=title[:200],
        domain=domain,
        unit=unit,
        author=user["name"],
        uploader_id=user["id"],
        description=description[:500],
        filename=original[:255],
        stored_name=stored_name,
        mime=MIME_BY_EXT[ext],
        size=size,
        storage_path=storage_path,
    )
    await db.sheets.insert_one(sheet.model_dump())

    # Les cartes se construisent côté serveur, après la réponse : la génération n'est plus
    # interrompue si l'utilisateur ferme son onglet juste après le dépôt. Les images n'ont
    # pas de texte exploitable, on ne lance rien pour elles.
    if not sheet.mime.startswith("image/"):
        background.add_task(build_deck_for_sheet, sheet.id, path, sheet.mime)

    return SheetOut.from_doc(sheet.model_dump())


@router.get("/sheets/favorites", response_model=list[str])
async def list_favorites(user: dict = Depends(current_user)):
    """Les identifiants des fiches épinglées par l'étudiant connecté (plus récentes d'abord)."""
    docs = (
        await db.sheet_favorites.find({"user_id": user["id"]})
        .sort("created_at", DESCENDING)
        .to_list(500)
    )
    return [doc["sheet_id"] for doc in docs]


@router.post("/sheets/{sheet_id}/favorite", status_code=201)
async def add_favorite(sheet_id: str, user: dict = Depends(current_user)):
    """Épingle une fiche. Idempotent : re-épingler ne crée pas de doublon."""
    await _find_or_404(sheet_id)
    favorite = SheetFavorite(user_id=user["id"], sheet_id=sheet_id)
    await db.sheet_favorites.update_one(
        {"user_id": user["id"], "sheet_id": sheet_id},
        {"$setOnInsert": favorite.model_dump()},
        upsert=True,
    )
    return {"sheet_id": sheet_id, "favorite": True}


@router.delete("/sheets/{sheet_id}/favorite", status_code=204)
async def remove_favorite(sheet_id: str, user: dict = Depends(current_user)):
    await db.sheet_favorites.delete_one({"user_id": user["id"], "sheet_id": sheet_id})
    return Response(status_code=204)


@router.get("/sheets/{sheet_id}/file")
async def sheet_file(sheet_id: str, _: dict = Depends(current_user)):
    """Inline preview — served to <iframe>/<img>, cookie rides same-origin."""
    doc = await _find_or_404(sheet_id)
    path = await ensure_local_file(doc)
    if path is None:
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")
    return FileResponse(
        path,
        media_type=doc["mime"],
        filename=doc["filename"],
        content_disposition_type="inline",
    )


@router.post("/sheets/{sheet_id}/view", response_model=SheetOut)
async def register_view(sheet_id: str, user: dict = Depends(current_user)):
    """Compte une ouverture de la fiche dans le lecteur, et l'étudiant comme lecteur distinct."""
    doc = await _find_or_404(sheet_id)
    await db.sheet_views.update_one(
        {"sheet_id": sheet_id, "user_id": user["id"]},
        {"$inc": {"count": 1}, "$set": {"last_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    await db.sheets.update_one({"id": sheet_id}, {"$inc": {"views": 1}})
    views = doc.get("views", 0) + 1
    viewers = await db.sheet_views.count_documents({"sheet_id": sheet_id})
    return SheetOut.from_doc({**doc, "views": views, "viewers": viewers})


@router.get("/sheets/{sheet_id}/text", response_model=SheetText)
async def sheet_text(sheet_id: str, _: dict = Depends(current_user)):
    """Contenu lisible d'une fiche TXT/DOCX/PDF — lecture sur le site, sans téléchargement."""
    doc = await _find_or_404(sheet_id)
    if doc["mime"].startswith("image/"):
        raise HTTPException(status_code=422, detail="Une image n'a pas de texte à afficher")
    path = await ensure_local_file(doc)
    if path is None:
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")
    text = extract_text(path, doc["mime"], limit=READ_CHARS)
    if not text:
        raise HTTPException(
            status_code=422,
            detail="Impossible d'extraire le texte de cette fiche (document scanné ou illisible)",
        )
    return SheetText(text=text, truncated=len(text) >= READ_CHARS)


@router.get("/sheets/{sheet_id}/html", response_model=SheetHtml)
async def sheet_html(sheet_id: str, _: dict = Depends(current_user)):
    """Rendu HTML d'un DOCX : titres, gras, listes, tableaux et images du document."""
    doc = await _find_or_404(sheet_id)
    if doc["mime"] != DOCX_MIME:
        raise HTTPException(status_code=422, detail="Rendu HTML réservé aux fiches Word (.docx)")
    path = await ensure_local_file(doc)
    if path is None:
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")
    html = docx_to_html(path, sheet_id, MEDIA_DIR)
    if not html:
        raise HTTPException(
            status_code=422, detail="Impossible de lire la mise en forme de ce document"
        )
    return SheetHtml(html=html)


@router.put("/sheets/{sheet_id}/diseases", response_model=SheetOut)
async def link_diseases(
    sheet_id: str,
    payload: SheetDiseaseLink,
    request: Request,
    user: dict = Depends(current_user),
):
    """Associe la fiche à des pathologies (auteur de la fiche ou admin déverrouillé)."""
    doc = await _find_or_404(sheet_id)
    session = await db.sessions.find_one({"token": request.cookies.get(COOKIE_NAME)})
    if doc.get("uploader_id") != user["id"] and not bool((session or {}).get("is_admin")):
        raise HTTPException(
            status_code=403, detail="Seul l'auteur de la fiche peut la relier à une pathologie"
        )

    slugs = list(dict.fromkeys(s.strip() for s in payload.slugs if s.strip()))[:12]
    known = await db.diseases.find({"slug": {"$in": slugs}}, {"_id": 0, "slug": 1}).to_list(20)
    valid = [d["slug"] for d in known]
    if len(valid) != len(slugs):
        raise HTTPException(status_code=422, detail="Pathologie inconnue")

    await db.sheets.update_one({"id": sheet_id}, {"$set": {"disease_slugs": valid}})
    return SheetOut.from_doc({**doc, "disease_slugs": valid})


@router.get("/sheets/{sheet_id}/media/{name}")
async def sheet_media(sheet_id: str, name: str, _: dict = Depends(current_user)):
    """Sert une image extraite d'un DOCX ; régénère le cache s'il a disparu (redéploiement)."""
    if not name.startswith(f"{sheet_id}-") or "/" in name or ".." in name:
        raise HTTPException(status_code=404, detail="Image introuvable")
    target = MEDIA_DIR / name
    if not target.is_file():
        doc = await _find_or_404(sheet_id)
        path = await ensure_local_file(doc)
        if path is None or doc["mime"] != DOCX_MIME:
            raise HTTPException(status_code=404, detail="Image introuvable")
        docx_to_html(path, sheet_id, MEDIA_DIR)  # réextrait toutes les images de la fiche
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Image introuvable")
    return FileResponse(target, headers={"Cache-Control": "public, max-age=86400"})


@router.get("/sheets/{sheet_id}/download")
async def sheet_download(sheet_id: str, user: dict = Depends(current_user)):
    doc = await _find_or_404(sheet_id)
    path = await ensure_local_file(doc)
    if path is None:
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")
    await db.sheets.update_one({"id": sheet_id}, {"$inc": {"downloads": 1}})
    await db.sheet_downloads.update_one(
        {"sheet_id": sheet_id, "user_id": user["id"]},
        {"$inc": {"count": 1}, "$set": {"last_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return FileResponse(path, media_type=doc["mime"], filename=doc["filename"])


@router.post("/sheets/{sheet_id}/report", response_model=SheetReportOut, status_code=201)
async def report_sheet(
    sheet_id: str,
    payload: SheetReportRequest,
    user: dict = Depends(current_user),
):
    """Signaler une fiche (contenu faux, hors-sujet, doublon). Visible dans l'espace admin."""
    doc = await _find_or_404(sheet_id)
    report = SheetReport(
        sheet_id=sheet_id,
        sheet_title=doc.get("title", ""),
        user_id=user["id"],
        user_name=user["name"],
        reason=payload.reason.strip()[:300],
    )
    await db.sheet_reports.insert_one(report.model_dump())
    return SheetReportOut(**report.model_dump())


@router.delete("/sheets/{sheet_id}", status_code=204)
async def delete_sheet(sheet_id: str, request: Request, user: dict = Depends(current_user)):
    doc = await _find_or_404(sheet_id)
    # Chacun supprime ses propres fiches ; l'admin (session déverrouillée) peut tout supprimer.
    session = await db.sessions.find_one({"token": request.cookies.get(COOKIE_NAME)})
    is_admin = bool((session or {}).get("is_admin"))
    if doc.get("uploader_id") != user["id"] and not is_admin:
        raise HTTPException(status_code=403, detail="Seul l'auteur de la fiche peut la supprimer")
    await db.sheets.delete_one({"id": sheet_id})
    await db.flashcards.delete_many({"sheet_id": sheet_id})  # pas de paquet orphelin
    await db.card_results.delete_many({"sheet_id": sheet_id})
    await db.card_schedules.delete_many({"sheet_id": sheet_id})
    await db.card_reports.delete_many({"sheet_id": sheet_id})
    await db.sheet_reports.delete_many({"sheet_id": sheet_id})
    await db.sheet_favorites.delete_many({"sheet_id": sheet_id})  # plus d'épingle orpheline
    await db.sheet_highlights.delete_many({"sheet_id": sheet_id})
    await db.sheet_views.delete_many({"sheet_id": sheet_id})
    await db.sheet_downloads.delete_many({"sheet_id": sheet_id})
    questions = await db.sheet_questions.find({"sheet_id": sheet_id}).to_list(500)
    if questions:
        await db.sheet_answers.delete_many({"question_id": {"$in": [q["id"] for q in questions]}})
        await db.sheet_questions.delete_many({"sheet_id": sheet_id})
    (UPLOADS_DIR / doc["stored_name"]).unlink(missing_ok=True)
    return Response(status_code=204)
