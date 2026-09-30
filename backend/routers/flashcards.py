"""Flashcards d'une fiche : liste + génération LLM (texte extrait du fichier)."""

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ASCENDING

from lib.db import db
from lib.flashcards import NO_CARDS, NO_TEXT, build_deck_for_sheet
from models.flashcard import FlashcardOut
from routers.auth import current_user
from routers.sheets import ensure_local_file

router = APIRouter(tags=["flashcards"])


async def _sheet_or_404(sheet_id: str) -> dict:
    doc = await db.sheets.find_one({"id": sheet_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Fiche introuvable")
    return doc


@router.get("/sheets/{sheet_id}/flashcards", response_model=list[FlashcardOut])
async def list_flashcards(sheet_id: str, _: dict = Depends(current_user)):
    await _sheet_or_404(sheet_id)
    docs = await db.flashcards.find({"sheet_id": sheet_id}).sort("order", ASCENDING).to_list(200)
    return [FlashcardOut.from_doc(d) for d in docs]


@router.post("/sheets/{sheet_id}/flashcards/generate", response_model=list[FlashcardOut])
async def generate_flashcards_for_sheet(sheet_id: str, _: dict = Depends(current_user)):
    doc = await _sheet_or_404(sheet_id)
    path = await ensure_local_file(doc)
    if path is None:
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")
    outcome = await build_deck_for_sheet(sheet_id, path, doc["mime"])
    if outcome == NO_TEXT:
        raise HTTPException(
            status_code=422,
            detail=(
                "Impossible d'extraire le texte de cette fiche — la génération a besoin "
                "d'un PDF, DOCX ou TXT lisible (pas d'image scannée)"
            ),
        )
    if outcome == NO_CARDS:
        raise HTTPException(status_code=502, detail="Génération impossible pour le moment — réessaie")

    docs = await db.flashcards.find({"sheet_id": sheet_id}).sort("order", ASCENDING).to_list(200)
    return [FlashcardOut.from_doc(d) for d in docs]
