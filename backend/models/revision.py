"""Méthode des J (répétition espacée) et signalement de cartes erronées."""

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from models.flashcard import StudyCard


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CardSchedule(BaseModel):
    """Échéance d'UNE carte pour UN étudiant. `level` indexe J_INTERVALS."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    card_id: str
    sheet_id: str
    level: int = 0
    due_date: str  # YYYY-MM-DD, ancré serveur (lib/dates.py)
    last_answered_at: datetime = Field(default_factory=utcnow)
    reviews: int = 0
    lapses: int = 0


class RevisionCard(StudyCard):
    """Carte du paquet du jour, enrichie de son palier J."""

    level: int = 0
    stage: str = "J0"  # libellé du palier courant : J0, J1, J3, J7, J15, J30
    next_stage: str = "J1"  # palier atteint si la réponse est juste
    is_new: bool = True  # jamais révisée jusqu'ici
    overdue_days: int = 0


class DayLoad(BaseModel):
    date: str
    count: int


class RevisionPlan(BaseModel):
    today: str
    due_today: int  # cartes en retard ou prévues aujourd'hui
    new_available: int  # cartes jamais révisées, disponibles à l'entrée dans le cycle
    scheduled: int  # cartes déjà dans un cycle de J
    mastered: int  # cartes au dernier palier (J30)
    total_cards: int
    upcoming: list[DayLoad]  # charge des 7 prochains jours


class CardReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    card_id: str
    sheet_id: str
    user_id: str
    user_name: str = ""
    reason: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class ReportRequest(BaseModel):
    reason: str = Field(default="", max_length=300)


class ReportOut(BaseModel):
    id: str
    card_id: str
    sheet_id: str
    user_name: str
    reason: str
    created_at: datetime
