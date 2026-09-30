"""Flashcards d'une fiche : liste + génération LLM (texte extrait du fichier)."""

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ASCENDING

from lib.db import db
from lib.extract import extract_text
from lib.flashcards import generate_flashcards
from models.flashcard import Flashcard, FlashcardOut
from routers.auth import require_access
from routers.sheets import UPLOADS_DIR

router = APIRouter(tags=["flashcards"])


async def _sheet_or_404(sheet_id: str) -> dict:
    doc = await db.sheets.find_one({"id": sheet_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Fiche introuvable")
    return doc


@router.get("/sheets/{sheet_id}/flashcards", response_model=list[FlashcardOut])
async def list_flashcards(sheet_id: str, _: None = Depends(require_access)):
    await _sheet_or_404(sheet_id)
    docs = await db.flashcards.find({"sheet_id": sheet_id}).sort("order", ASCENDING).to_list(200)
    return [FlashcardOut(**d) for d in docs]


@router.post("/sheets/{sheet_id}/flashcards/generate", response_model=list[FlashcardOut])
async def generate_flashcards_for_sheet(sheet_id: str, _: None = Depends(require_access)):
    doc = await _sheet_or_404(sheet_id)
    text = extract_text(UPLOADS_DIR / doc["stored_name"], doc["mime"])
    if len(text) < 60:
        raise HTTPException(
            status_code=422,
            detail=(
                "Impossible d'extraire le texte de cette fiche — la génération a besoin "
                "d'un PDF, DOCX ou TXT lisible (pas d'image scannée)"
            ),
        )

    cards = await generate_flashcards(text)
    if not cards:
        raise HTTPException(status_code=502, detail="Génération impossible pour le moment — réessaie")

    await db.flashcards.delete_many({"sheet_id": sheet_id})
    await db.flashcards.insert_many(
        [
            Flashcard(sheet_id=sheet_id, question=c["question"], answer=c["answer"], order=i).model_dump()
            for i, c in enumerate(cards)
        ]
    )
    docs = await db.flashcards.find({"sheet_id": sheet_id}).sort("order", ASCENDING).to_list(200)
    return [FlashcardOut(**d) for d in docs]
