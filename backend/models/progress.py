"""Progression personnelle + classement de la promo."""

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CardResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    card_id: str
    sheet_id: str
    domain: str = ""
    unit: str = ""
    correct: bool
    mode: str = "flash"  # "flash" (auto-évaluation) ou "quiz" (QCM)
    answered_at: datetime = Field(default_factory=utcnow)


class AnswerRequest(BaseModel):
    card_id: str
    correct: bool
    mode: str = "flash"


class DomainProgress(BaseModel):
    domain: str
    answered: int
    correct: int
    accuracy: int  # pourcentage arrondi


class ProgressStats(BaseModel):
    answered: int
    correct: int
    accuracy: int
    mastered: int  # cartes dont la dernière réponse est juste
    to_review: int  # cartes dont la dernière réponse est fausse
    sessions_days: int  # nombre de jours distincts avec au moins une réponse
    per_domain: list[DomainProgress]


class LeaderboardEntry(BaseModel):
    user_id: str
    name: str
    answered: int
    correct: int
    accuracy: int
    sheets_uploaded: int
    is_me: bool = False
