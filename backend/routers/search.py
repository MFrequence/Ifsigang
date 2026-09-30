"""Recherche globale : fiches, lexique et fiches pharmaco en une seule requête."""

import re

from fastapi import APIRouter, Depends, Query

from lib.db import db
from models.search import GlobalSearchResults, SearchHit
from routers.auth import current_user

router = APIRouter(prefix="/search", tags=["search"])

LIMIT = 8


def _regex(term: str) -> dict:
    return {"$regex": re.escape(term), "$options": "i"}


@router.get("", response_model=GlobalSearchResults)
async def global_search(q: str = Query(min_length=2, max_length=80), _: dict = Depends(current_user)):
    term = q.strip()
    pattern = _regex(term)

    sheets = await db.sheets.find(
        {
            "$or": [
                {"title": pattern},
                {"description": pattern},
                {"unit": pattern},
                {"uploader_name": pattern},
            ]
        }
    ).to_list(LIMIT)

    lexicon = await db.lexicon.find(
        {"$or": [{"term": pattern}, {"definition": pattern}]}
    ).to_list(LIMIT)

    drugs = await db.drug_cards.find(
        {"$or": [{"label": pattern}, {"dci": pattern}, {"drug_class": pattern}]}
    ).to_list(LIMIT)

    return GlobalSearchResults(
        query=term,
        sheets=[
            SearchHit(
                id=s["id"],
                title=s.get("title", ""),
                subtitle=" · ".join(
                    part
                    for part in [
                        f"Domaine {s.get('domain', '')}",
                        f"UE {s['unit']}" if s.get("unit") else "",
                        s.get("uploader_name", ""),
                    ]
                    if part
                ),
                kind="sheet",
            )
            for s in sheets
        ],
        lexicon=[
            SearchHit(
                id=entry["id"],
                title=entry["term"],
                subtitle=entry["definition"][:140],
                kind="lexicon",
                category=entry.get("category", "general"),
            )
            for entry in lexicon
        ],
        drugs=[
            SearchHit(
                id=card["cis"],
                title=card.get("label", ""),
                subtitle=" · ".join(
                    part for part in [card.get("dci", ""), card.get("drug_class", "")] if part
                ),
                kind="drug",
            )
            for card in drugs
        ],
    )
