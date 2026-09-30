"""Planning de révisions avant partiel : modèles."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.sheet import utcnow


class PlanCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    domain: str
    unit: str = Field(default="", max_length=40)
    exam_date: str  # YYYY-MM-DD


class RevisionPlan(BaseModel):
    """Document stocké : le programme lui-même est recalculé à chaque lecture."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    domain: str
    unit: str = ""
    exam_date: str
    done_sheet_ids: list[str] = []
    created_at: datetime = Field(default_factory=utcnow)


class PlanSheet(BaseModel):
    id: str
    title: str
    unit: str = ""
    mime: str
    done: bool = False


class PlanDay(BaseModel):
    date: str
    label: str
    is_today: bool = False
    is_past: bool = False
    is_review: bool = False
    sheets: list[PlanSheet] = []


class PlanOut(BaseModel):
    id: str
    title: str
    domain: str
    unit: str = ""
    exam_date: str
    days_left: int
    total_sheets: int
    done_count: int
    cards_total: int = 0
    days: list[PlanDay] = []
