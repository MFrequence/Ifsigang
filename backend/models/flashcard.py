"""Flashcard models — a deck belongs to one sheet. `distractors` alimente le mode QCM."""

import uuid

from pydantic import BaseModel, Field


class Flashcard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sheet_id: str
    question: str
    answer: str
    distractors: list[str] = Field(default_factory=list)
    order: int = 0
    reports: int = 0


class FlashcardOut(BaseModel):
    id: str
    sheet_id: str
    question: str
    answer: str
    distractors: list[str] = Field(default_factory=list)
    order: int
    reports: int = 0

    @classmethod
    def from_doc(cls, doc: dict) -> "FlashcardOut":
        # Les cartes créées avant le mode QCM / le signalement n'ont pas ces champs.
        if doc.get("distractors") is None:
            doc = {**doc, "distractors": []}
        if doc.get("reports") is None:
            doc = {**doc, "reports": 0}
        return cls(**doc)


class StudyCard(FlashcardOut):
    """Carte enrichie du contexte de sa fiche, pour les sessions domaine/UE."""

    sheet_title: str
    domain: str
    unit: str = ""
    # Vrai si l'utilisateur a raté cette carte la dernière fois (priorisée en tête de session).
    due: bool = False
