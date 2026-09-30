"""Signalement d'une flashcard erronée : n'importe qui peut lever la main."""

from fastapi import APIRouter, Depends, HTTPException
from pymongo import DESCENDING

from lib.db import db
from models.revision import CardReport, ReportOut, ReportRequest
from routers.auth import current_user

router = APIRouter(tags=["reports"])


@router.post("/flashcards/{card_id}/report", response_model=ReportOut, status_code=201)
async def report_card(
    card_id: str,
    payload: ReportRequest,
    user: dict = Depends(current_user),
):
    card = await db.flashcards.find_one({"id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Carte introuvable")

    report = CardReport(
        card_id=card_id,
        sheet_id=card["sheet_id"],
        user_id=user["id"],
        user_name=user["name"],
        reason=payload.reason.strip()[:300],
    )
    await db.card_reports.insert_one(report.model_dump())
    # Compteur porté par la carte : pas de jointure nécessaire à l'affichage.
    await db.flashcards.update_one({"id": card_id}, {"$inc": {"reports": 1}})
    return ReportOut(**report.model_dump())


@router.get("/sheets/{sheet_id}/reports", response_model=list[ReportOut])
async def sheet_reports(sheet_id: str, _: dict = Depends(current_user)):
    docs = (
        await db.card_reports.find({"sheet_id": sheet_id})
        .sort("created_at", DESCENDING)
        .to_list(200)
    )
    return [ReportOut(**d) for d in docs]


@router.delete("/flashcards/{card_id}/report", status_code=204)
async def clear_reports(card_id: str, _: dict = Depends(current_user)):
    """Signalements traités : on repart de zéro (utilisé après correction/régénération)."""
    await db.card_reports.delete_many({"card_id": card_id})
    await db.flashcards.update_one({"id": card_id}, {"$set": {"reports": 0}})
