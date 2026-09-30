"""Schémas d'anatomie à compléter : exercices et résultats."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.reference import utcnow


class DiagramSummary(BaseModel):
    slug: str
    title: str
    system: str
    hint: str = ""
    image_url: str
    marker_count: int
    best_score: int = 0  # meilleur score de l'étudiant connecté
    attempts: int = 0


class DiagramExercise(BaseModel):
    """Énoncé envoyé au client : les numéros et les étiquettes mélangées, jamais le mapping."""

    slug: str
    title: str
    system: str
    hint: str = ""
    image_url: str
    numbers: list[int]
    labels: list[str]


class DiagramAttemptRequest(BaseModel):
    # numéro de repère (en texte) -> étiquette déposée
    answers: dict[str, str]


class DiagramAttemptResult(BaseModel):
    slug: str
    score: int
    total: int
    correct_numbers: list[int]
    solution: dict[str, str]  # la correction, renvoyée seulement après validation
    best_score: int


class DiagramAttempt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    slug: str
    score: int
    total: int
    created_at: datetime = Field(default_factory=utcnow)
