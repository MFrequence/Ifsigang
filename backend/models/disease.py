"""Fiches pathologies : modèles.

Une fiche naît du catalogue (`lib/disease_seed.py`) avec sa définition courte, puis ses
rubriques détaillées sont complétées une seule fois par le LLM (`lib/disease.py`) et
conservées en base pour toute la promo. L'admin peut ensuite les corriger.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.sheet import utcnow

DETAIL_FIELDS = (
    "causes",
    "symptoms",
    "exams",
    "treatments",
    "side_effects",
    "nursing_role",
    "key_points",
)


class Disease(BaseModel):
    """Document stocké dans `diseases`."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: str
    name: str
    category: str = "autre"
    definition: str = ""
    incubation: str = ""
    causes: list[str] = []
    symptoms: list[str] = []
    exams: list[str] = []
    treatments: list[str] = []
    side_effects: list[str] = []
    nursing_role: list[str] = []
    key_points: list[str] = []
    source: str = "seed"  # seed | ai
    detailed: bool = False  # True dès que les rubriques détaillées sont remplies
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class DiseaseSummary(BaseModel):
    """Entrée de liste (la page index n'a pas besoin des rubriques)."""

    slug: str
    name: str
    category: str
    category_label: str = ""
    definition: str = ""
    detailed: bool = False
    source: str = "seed"


class DiseaseOut(BaseModel):
    slug: str
    name: str
    category: str
    category_label: str = ""
    definition: str = ""
    incubation: str = ""
    causes: list[str] = []
    symptoms: list[str] = []
    exams: list[str] = []
    treatments: list[str] = []
    side_effects: list[str] = []
    nursing_role: list[str] = []
    key_points: list[str] = []
    detailed: bool = False
    source: str = "seed"


class DiseaseCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    category: str = "autre"


class DiseaseUpdate(BaseModel):
    """Correction d'une fiche par l'admin : seuls les champs fournis sont écrasés."""

    name: str | None = Field(default=None, min_length=3, max_length=120)
    category: str | None = None
    definition: str | None = None
    incubation: str | None = None
    causes: list[str] | None = None
    symptoms: list[str] | None = None
    exams: list[str] | None = None
    treatments: list[str] | None = None
    side_effects: list[str] | None = None
    nursing_role: list[str] | None = None
    key_points: list[str] | None = None
