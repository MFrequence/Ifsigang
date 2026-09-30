"""Recherche globale (fiches + lexique + pharmaco)."""

from pydantic import BaseModel


class SearchHit(BaseModel):
    id: str
    title: str
    subtitle: str = ""
    kind: str  # "sheet" | "lexicon" | "drug"
    category: str = ""


class GlobalSearchResults(BaseModel):
    query: str
    sheets: list[SearchHit] = []
    lexicon: list[SearchHit] = []
    drugs: list[SearchHit] = []
