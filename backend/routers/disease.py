"""Fiches pathologies : catalogue, lecture (avec complétion LLM à la demande) et édition admin."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pymongo import ASCENDING

from lib.db import db
from lib.disease import NO_LLM, build_details
from lib.disease_seed import CATEGORIES, slugify
from models.sheet import SheetOut
from models.disease import (
    Disease,
    DiseaseCreate,
    DiseaseOut,
    DiseaseSummary,
    DiseaseUpdate,
)
from routers.admin import admin_guard
from routers.auth import current_user

router = APIRouter(prefix="/diseases", tags=["diseases"])


def _out(doc: dict) -> DiseaseOut:
    return DiseaseOut(
        **{k: v for k, v in doc.items() if k in DiseaseOut.model_fields},
        category_label=CATEGORIES.get(doc.get("category", ""), "Autre"),
    )


@router.get("/categories", response_model=dict[str, str])
async def categories(_: dict = Depends(current_user)):
    return CATEGORIES


@router.get("/favorites", response_model=list[str])
async def list_favorites(user: dict = Depends(current_user)):
    """Slugs des pathologies épinglées par l'étudiant (déclaré avant `/{slug}`)."""
    docs = await db.disease_favorites.find({"user_id": user["id"]}, {"_id": 0}).to_list(300)
    return [doc["slug"] for doc in docs]


@router.get("", response_model=list[DiseaseSummary])
async def list_diseases(
    q: str | None = None,
    category: str | None = None,
    _: dict = Depends(current_user),
):
    """Catalogue filtrable (recherche sur le nom et la définition)."""
    query: dict = {}
    if category and category in CATEGORIES:
        query["category"] = category
    if q and q.strip():
        needle = {"$regex": q.strip(), "$options": "i"}
        query["$or"] = [{"name": needle}, {"definition": needle}]

    docs = await db.diseases.find(query, {"_id": 0}).sort("name", ASCENDING).to_list(500)
    return [
        DiseaseSummary(
            slug=doc["slug"],
            name=doc["name"],
            category=doc.get("category", "autre"),
            category_label=CATEGORIES.get(doc.get("category", ""), "Autre"),
            definition=doc.get("definition", ""),
            detailed=bool(doc.get("detailed")),
            source=doc.get("source", "seed"),
        )
        for doc in docs
    ]


@router.get("/{slug}", response_model=DiseaseOut)
async def get_disease(slug: str, _: dict = Depends(current_user)):
    """Fiche complète ; les rubriques sont générées à la première ouverture puis conservées."""
    doc = await db.diseases.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pathologie introuvable")

    if not doc.get("detailed"):
        result = await build_details(
            slug, doc["name"], CATEGORIES.get(doc.get("category", ""), "")
        )
        if result == NO_LLM:
            raise HTTPException(
                status_code=503,
                detail="Fiche indisponible pour le moment — réessaie dans un instant",
            )
        doc = await db.diseases.find_one({"slug": slug}, {"_id": 0}) or doc

    return _out(doc)


@router.get("/{slug}/sheets", response_model=list[SheetOut])
async def disease_sheets(slug: str, _: dict = Depends(current_user)):
    """Fiches de cours de la promo reliées à cette pathologie."""
    docs = await db.sheets.find({"disease_slugs": slug}).sort("created_at", ASCENDING).to_list(100)
    return [SheetOut.from_doc(doc) for doc in docs]


@router.post("/{slug}/favorite", status_code=201)
async def add_favorite(slug: str, user: dict = Depends(current_user)):
    """Épingle une pathologie. Idempotent."""
    if not await db.diseases.find_one({"slug": slug}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Pathologie introuvable")
    await db.disease_favorites.update_one(
        {"user_id": user["id"], "slug": slug},
        {"$setOnInsert": {"user_id": user["id"], "slug": slug}},
        upsert=True,
    )
    return {"slug": slug, "favorite": True}


@router.delete("/{slug}/favorite", status_code=204)
async def remove_favorite(slug: str, user: dict = Depends(current_user)):
    await db.disease_favorites.delete_one({"user_id": user["id"], "slug": slug})
    return Response(status_code=204)


@router.post("", response_model=DiseaseOut, status_code=201)
async def create_disease(payload: DiseaseCreate, _: dict = Depends(current_user)):
    """Ajoute une pathologie absente du catalogue : la fiche est générée puis partagée."""
    name = " ".join(payload.name.split())
    slug = slugify(name)
    if not slug:
        raise HTTPException(status_code=422, detail="Nom de pathologie invalide")

    existing = await db.diseases.find_one({"slug": slug}, {"_id": 0})
    if existing:  # déjà au catalogue : on renvoie la fiche existante
        return await get_disease(slug)

    category = payload.category if payload.category in CATEGORIES else "autre"
    disease = Disease(slug=slug, name=name, category=category, source="ai")
    await db.diseases.insert_one(disease.model_dump())

    result = await build_details(slug, name, CATEGORIES.get(category, ""))
    if result == NO_LLM:
        await db.diseases.delete_one({"slug": slug})  # pas de fiche vide au catalogue
        raise HTTPException(
            status_code=503, detail="Génération impossible pour le moment — réessaie"
        )
    doc = await db.diseases.find_one({"slug": slug}, {"_id": 0})
    return _out(doc or disease.model_dump())


@router.put("/{slug}", response_model=DiseaseOut)
async def update_disease(slug: str, payload: DiseaseUpdate, _: dict = Depends(admin_guard)):
    """Correction d'une fiche par l'admin (seuls les champs envoyés sont modifiés)."""
    doc = await db.diseases.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pathologie introuvable")

    update = payload.model_dump(exclude_none=True)
    if update.get("category") and update["category"] not in CATEGORIES:
        raise HTTPException(status_code=422, detail="Catégorie inconnue")
    if not update:
        raise HTTPException(status_code=422, detail="Aucune modification fournie")

    update["updated_at"] = datetime.now(timezone.utc)
    await db.diseases.update_one({"slug": slug}, {"$set": update})
    return _out({**doc, **update})


@router.delete("/{slug}", status_code=204)
async def delete_disease(slug: str, _: dict = Depends(admin_guard)):
    result = await db.diseases.delete_one({"slug": slug})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pathologie introuvable")
    await db.disease_favorites.delete_many({"slug": slug})
    await db.sheets.update_many({"disease_slugs": slug}, {"$pull": {"disease_slugs": slug}})
    return Response(status_code=204)
