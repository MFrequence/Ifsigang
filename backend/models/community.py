"""Surlignages personnels et entraide de promo autour d'une fiche."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.sheet import utcnow


class HighlightCreate(BaseModel):
    text: str = Field(min_length=3, max_length=600)


class Highlight(BaseModel):
    """Passage surligné par UN étudiant : la fiche partagée n'est jamais modifiée."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    sheet_id: str
    text: str
    created_at: datetime = Field(default_factory=utcnow)


class HighlightOut(BaseModel):
    id: str
    text: str
    created_at: datetime


class QuestionCreate(BaseModel):
    body: str = Field(min_length=3, max_length=800)


class AnswerCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1500)


class Question(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sheet_id: str
    user_id: str
    author: str
    body: str
    created_at: datetime = Field(default_factory=utcnow)


class Answer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question_id: str
    sheet_id: str
    user_id: str
    author: str
    body: str
    best: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class AnswerOut(BaseModel):
    id: str
    author: str
    body: str
    best: bool = False
    mine: bool = False
    created_at: datetime


class QuestionOut(BaseModel):
    id: str
    author: str
    body: str
    mine: bool = False
    created_at: datetime
    answers: list[AnswerOut] = []
