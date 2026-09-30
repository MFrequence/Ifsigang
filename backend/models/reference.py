"""Lexique infirmier (par lieu de stage) et fiches pharmacologiques."""

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field

# Catégories de lieux de stage — mirrored in frontend/src/lib/lexicon.ts
LEXICON_CATEGORIES: dict[str, str] = {
    "general": "Transversal",
    "medecine": "Médecine",
    "chirurgie": "Chirurgie / Bloc",
    "urgences": "Urgences / Réanimation",
    "psychiatrie": "Psychiatrie",
    "ehpad": "EHPAD / Gériatrie",
    "pediatrie": "Pédiatrie / Maternité",
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LexiconEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    term: str
    definition: str
    category: str = "general"
    author_id: str = ""  # vide = entrée fournie avec la plateforme
    author_name: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class LexiconEntryCreate(BaseModel):
    term: str = Field(min_length=1, max_length=80)
    definition: str = Field(min_length=2, max_length=600)
    category: str = "general"


class LexiconEntryOut(BaseModel):
    id: str
    term: str
    definition: str
    category: str
    author_name: str = ""
    is_mine: bool = False
    editable: bool = False  # faux pour les entrées fournies avec la plateforme


class DrugSearchResult(BaseModel):
    cis: str
    label: str
    form: str = ""
    routes: list[str] = []
    holder: str = ""
    marketed: bool = False
    substances: list[str] = []
    cached: bool = False  # une fiche est déjà disponible sans attente


class DrugCard(BaseModel):
    cis: str
    label: str
    dci: str = ""
    drug_class: str = ""
    indications: list[str] = []
    dosage: list[str] = []
    side_effects: list[str] = []
    contraindications: list[str] = []
    nursing_watch: list[str] = []
    source: str = ""
