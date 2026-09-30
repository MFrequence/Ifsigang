"""Flashcard models — a deck belongs to one sheet."""

import uuid

from pydantic import BaseModel, Field


class Flashcard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sheet_id: str
    question: str
    answer: str
    order: int = 0


class FlashcardOut(BaseModel):
    id: str
    question: str
    answer: str
    order: int
