"""Lexique infirmier : consultation par catégorie de stage + contributions de la promo."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from lib.db import db
from models.reference import (
    LEXICON_CATEGORIES,
    LexiconEntry,
    LexiconEntryCreate,
    LexiconEntryOut,
)
from routers.auth import COOKIE_NAME, current_user

router = APIRouter(prefix="/lexicon", tags=["lexicon"])


def _out(doc: dict, user_id: str, is_admin: bool) -> LexiconEntryOut:
    mine = bool(doc.get("author_id")) and doc["author_id"] == user_id
    return LexiconEntryOut(
        id=doc["id"],
        term=doc["term"],
        definition=doc["definition"],
        category=doc.get("category", "general"),
        author_name=doc.get("author_name", ""),
        is_mine=mine,
        editable=mine or is_admin,
    )


@router.get("", response_model=list[LexiconEntryOut])
async def list_entries(
    request: Request,
    category: str | None = Query(default=None),
    user: dict = Depends(current_user),
):
    query: dict = {}
    if category and category != "ALL":
        if category not in LEXICON_CATEGORIES:
            raise HTTPException(status_code=422, detail="Catégorie inconnue")
        query["category"] = category

    session = await db.sessions.find_one({"token": request.cookies.get(COOKIE_NAME)})
    is_admin = bool((session or {}).get("is_admin"))
    docs = await db.lexicon.find(query).to_list(2000)
    docs.sort(key=lambda d: d["term"].casefold())
    return [_out(d, user["id"], is_admin) for d in docs]


@router.post("", response_model=LexiconEntryOut, status_code=201)
async def create_entry(payload: LexiconEntryCreate, user: dict = Depends(current_user)):
    if payload.category not in LEXICON_CATEGORIES:
        raise HTTPException(status_code=422, detail="Catégorie inconnue")
    term = payload.term.strip()
    if await db.lexicon.find_one({"term": term, "category": payload.category}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="Ce terme existe déjà dans cette catégorie")

    entry = LexiconEntry(
        term=term,
        definition=payload.definition.strip(),
        category=payload.category,
        author_id=user["id"],
        author_name=user["name"],
    )
    await db.lexicon.insert_one(entry.model_dump())
    return LexiconEntryOut(
        id=entry.id,
        term=entry.term,
        definition=entry.definition,
        category=entry.category,
        author_name=entry.author_name,
        is_mine=True,
        editable=True,
    )


@router.delete("/{entry_id}", status_code=204)
async def delete_entry(entry_id: str, request: Request, user: dict = Depends(current_user)):
    """Chacun supprime ses propres ajouts ; l'admin peut tout retirer."""
    doc = await db.lexicon.find_one({"id": entry_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Entrée introuvable")
    session = await db.sessions.find_one({"token": request.cookies.get(COOKIE_NAME)})
    is_admin = bool((session or {}).get("is_admin"))
    if doc.get("author_id") != user["id"] and not is_admin:
        raise HTTPException(status_code=403, detail="Seul l'auteur de l'entrée peut la supprimer")
    await db.lexicon.delete_one({"id": entry_id})
    return Response(status_code=204)
