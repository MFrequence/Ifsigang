"""Examen blanc : 20 QCM tirés au hasard dans un domaine ou une UE, avec note finale."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.reference import utcnow

EXAM_SIZE = 20


class ExamQuestion(BaseModel):
    card_id: str
    question: str
    choices: list[str]  # bonne réponse mélangée avec les distracteurs
    sheet_title: str = ""
    unit: str = ""


class Exam(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    scope: str = ""  # libellé du périmètre (domaine / UE)
    domain: str = ""
    unit: str = ""
    # card_id -> bonne réponse (jamais envoyé au client avant la correction)
    solutions: dict[str, str] = {}
    created_at: datetime = Field(default_factory=utcnow)


class ExamOut(BaseModel):
    id: str
    scope: str
    total: int
    questions: list[ExamQuestion]


class ExamSubmission(BaseModel):
    answers: dict[str, str]  # card_id -> réponse choisie
    seconds: int = 0


class ExamCorrection(BaseModel):
    card_id: str
    question: str
    given: str = ""
    expected: str
    correct: bool
    sheet_title: str = ""


class ExamResultOut(BaseModel):
    id: str
    scope: str
    score: int
    total: int
    mark: float  # note ramenée sur 20
    seconds: int
    corrections: list[ExamCorrection]


class ExamResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    exam_id: str
    scope: str = ""
    score: int
    total: int
    seconds: int = 0
    created_at: datetime = Field(default_factory=utcnow)


class ExamHistoryEntry(BaseModel):
    scope: str
    score: int
    total: int
    mark: float
    seconds: int
    created_at: datetime
