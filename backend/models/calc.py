"""Calculs de doses : exercices générés et correction pas à pas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.reference import utcnow


class CalcExercise(BaseModel):
    """Énoncé envoyé au client — sans la réponse ni les étapes."""

    id: str
    type: str
    label: str
    statement: str
    unit: str


class CalcAnswerRequest(BaseModel):
    exercise_id: str
    answer: float


class CalcAnswerResult(BaseModel):
    correct: bool
    expected: float
    unit: str
    steps: list[str]
    streak: int  # bonnes réponses consécutives dans la session en cours


class CalcStats(BaseModel):
    answered: int
    correct: int
    accuracy: int
    per_type: dict[str, int]  # type -> nombre de bonnes réponses


class CalcAttempt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    exercise_id: str
    type: str
    correct: bool
    given: float
    expected: float
    created_at: datetime = Field(default_factory=utcnow)
