"""Sessions de révision agrégées : toutes les cartes d'un domaine ou d'une UE.

Les cartes ratées la dernière fois par l'utilisateur remontent en tête (`due`).
"""

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from models.flashcard import StudyCard
from models.sheet import DOMAINS
from routers.auth import current_user

router = APIRouter(prefix="/study", tags=["study"])


@router.get("/deck", response_model=list[StudyCard])
async def study_deck(
    domain: str | None = None,
    unit: str | None = None,
    user: dict = Depends(current_user),
):
    query: dict = {}
    if domain is not None:
        if domain not in DOMAINS:
            raise HTTPException(status_code=422, detail="Domaine inconnu")
        query["domain"] = domain
    if unit:
        query["unit"] = unit

    sheets = await db.sheets.find(query).to_list(500)
    if not sheets:
        return []
    by_id = {s["id"]: s for s in sheets}

    cards = await db.flashcards.find({"sheet_id": {"$in": list(by_id)}}).to_list(3000)
    if not cards:
        return []

    # Dernière réponse de CET utilisateur par carte → priorisation des cartes ratées.
    results = await db.card_results.find(
        {"user_id": user["id"], "card_id": {"$in": [c["id"] for c in cards]}}
    ).to_list(10000)
    last_by_card: dict[str, dict] = {}
    for r in sorted(results, key=lambda x: x.get("answered_at") or 0):
        last_by_card[r["card_id"]] = r

    deck: list[StudyCard] = []
    for card in cards:
        sheet = by_id[card["sheet_id"]]
        last = last_by_card.get(card["id"])
        deck.append(
            StudyCard(
                id=card["id"],
                sheet_id=card["sheet_id"],
                question=card["question"],
                answer=card["answer"],
                distractors=card.get("distractors") or [],
                order=card.get("order", 0),
                sheet_title=sheet.get("title", ""),
                domain=sheet.get("domain", ""),
                unit=sheet.get("unit") or "",
                reports=card.get("reports", 0),
                # Jamais vue ou ratée la dernière fois → à revoir en priorité.
                due=last is None or not last.get("correct"),
            )
        )

    # Ratées d'abord, puis jamais vues, puis les maîtrisées.
    deck.sort(key=lambda c: (not c.due, c.sheet_title, c.order))
    return deck
