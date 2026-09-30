"""Pharmacologie : recherche dans la base publique des médicaments (ANSM) + fiche IDE."""

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.bdpm import search_medicaments
from lib.db import db
from lib.pharmaco import NO_LLM, NO_RCP, build_card, cached_card
from models.reference import DrugCard, DrugSearchResult
from routers.auth import current_user

router = APIRouter(prefix="/pharmaco", tags=["pharmaco"])


@router.get("/search", response_model=list[DrugSearchResult])
async def search(q: str = Query(min_length=3, max_length=80), _: dict = Depends(current_user)):
    results = await search_medicaments(q)
    if not results:
        return []
    known = {
        d["cis"]
        for d in await db.drug_cards.find(
            {"cis": {"$in": [r["cis"] for r in results]}}, {"cis": 1}
        ).to_list(100)
    }
    return [DrugSearchResult(**r, cached=r["cis"] in known) for r in results]


@router.get("/cards", response_model=list[DrugCard])
async def recent_cards(_: dict = Depends(current_user)):
    """Fiches déjà générées : la page n'est jamais vide et aucune attente pour la promo."""
    docs = await db.drug_cards.find({}, {"_id": 0}).sort("generated_at", -1).to_list(60)
    return [DrugCard(**d) for d in docs]


@router.get("/cards/{cis}", response_model=DrugCard)
async def card(cis: str, _: dict = Depends(current_user)):
    existing = await cached_card(cis)
    if existing:
        return DrugCard(**existing)

    result = await build_card(cis)
    if result == NO_RCP:
        raise HTTPException(
            status_code=404, detail="Aucun RCP exploitable pour ce médicament dans la base ANSM"
        )
    if result == NO_LLM:
        raise HTTPException(
            status_code=502, detail="Synthèse indisponible pour le moment — réessaie plus tard"
        )
    return DrugCard(**result)  # type: ignore[arg-type]
