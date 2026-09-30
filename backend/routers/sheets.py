"""Fiches de révision: upload (multipart), listing, inline preview, download, delete.

Files live on disk in backend/uploads/ (uuid names, never user input in a path);
metadata lives in Mongo. Toutes les routes exigent une session (compte étudiant).
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from pymongo import DESCENDING

from lib.db import db
from lib.flashcards import build_deck_for_sheet
from models.sheet import DOMAINS, Sheet, SheetOut
from routers.auth import current_user

router = APIRouter(tags=["sheets"])

MAX_SIZE = 10 * 1024 * 1024  # 10 Mo
ALLOWED_EXTS = {"pdf", "png", "jpg", "jpeg", "docx", "txt"}
MIME_BY_EXT = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
}
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
CHUNK = 1024 * 1024

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


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
    return [SheetOut.from_doc(doc) for doc in docs]


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
            raise HTTPException(status_code=413, detail="Fichier trop lourd (10 Mo max)")
        chunks.append(chunk)

    stored_name = f"{uuid.uuid4().hex}.{ext}"
    path = UPLOADS_DIR / stored_name
    path.write_bytes(b"".join(chunks))

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
    )
    await db.sheets.insert_one(sheet.model_dump())

    # Les cartes se construisent côté serveur, après la réponse : la génération n'est plus
    # interrompue si l'utilisateur ferme son onglet juste après le dépôt. Les images n'ont
    # pas de texte exploitable, on ne lance rien pour elles.
    if not sheet.mime.startswith("image/"):
        background.add_task(build_deck_for_sheet, sheet.id, path, sheet.mime)

    return SheetOut.from_doc(sheet.model_dump())


@router.get("/sheets/{sheet_id}/file")
async def sheet_file(sheet_id: str, _: dict = Depends(current_user)):
    """Inline preview — served to <iframe>/<img>, cookie rides same-origin."""
    doc = await _find_or_404(sheet_id)
    path = UPLOADS_DIR / doc["stored_name"]
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")
    return FileResponse(
        path,
        media_type=doc["mime"],
        filename=doc["filename"],
        content_disposition_type="inline",
    )


@router.get("/sheets/{sheet_id}/download")
async def sheet_download(sheet_id: str, _: dict = Depends(current_user)):
    doc = await _find_or_404(sheet_id)
    path = UPLOADS_DIR / doc["stored_name"]
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")
    await db.sheets.update_one({"id": sheet_id}, {"$inc": {"downloads": 1}})
    return FileResponse(path, media_type=doc["mime"], filename=doc["filename"])


@router.delete("/sheets/{sheet_id}", status_code=204)
async def delete_sheet(sheet_id: str, _: dict = Depends(current_user)):
    doc = await _find_or_404(sheet_id)
    await db.sheets.delete_one({"id": sheet_id})
    await db.flashcards.delete_many({"sheet_id": sheet_id})  # pas de paquet orphelin
    await db.card_results.delete_many({"sheet_id": sheet_id})
    await db.card_schedules.delete_many({"sheet_id": sheet_id})
    await db.card_reports.delete_many({"sheet_id": sheet_id})
    (UPLOADS_DIR / doc["stored_name"]).unlink(missing_ok=True)
    return Response(status_code=204)
