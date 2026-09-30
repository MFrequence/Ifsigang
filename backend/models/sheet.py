"""Fiche de révision models + the IFSI domain registry (Domaines A-E)."""

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field

# Single source of truth for the five IFSI domains — mirrored as a TS constant in
# frontend/src/lib/domains.ts (nothing infers across the language boundary).
DOMAINS: dict[str, dict[str, str]] = {
    "A": {"label": "Domaine A", "description": "Sciences humaines, sociales et droit"},
    "B": {"label": "Domaine B", "description": "Sciences biologiques et médicales"},
    "C": {"label": "Domaine C", "description": "Sciences et techniques infirmières : fondements"},
    "D": {"label": "Domaine D", "description": "Sciences et techniques infirmières : interventions"},
    "E": {"label": "Domaine E", "description": "Intégration des savoirs et posture professionnelle"},
}


def utcnow() -> datetime:
    """Aware UTC now — store aware so Pydantic serialises with an offset."""
    return datetime.now(timezone.utc)


class Sheet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    domain: str
    unit: str = ""
    author: str
    uploader_id: str = ""
    description: str = ""
    filename: str
    stored_name: str
    mime: str
    size: int
    downloads: int = 0
    created_at: datetime = Field(default_factory=utcnow)


class SheetOut(BaseModel):
    """Public shape of a fiche — stored_name never leaves the server."""

    id: str
    title: str
    domain: str
    unit: str = ""
    author: str
    uploader_id: str = ""
    description: str = ""
    filename: str
    mime: str
    size: int
    downloads: int = 0
    created_at: datetime

    @classmethod
    def from_doc(cls, doc: dict) -> "SheetOut":
        # Motor hands back naive UTC datetimes — normalise so JS Date parses with the right offset.
        created = doc.get("created_at")
        if isinstance(created, datetime) and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
            doc = {**doc, "created_at": created}
        # Documents written before `unit` existed carry None — coerce so the str field validates.
        if doc.get("unit") is None:
            doc = {**doc, "unit": ""}
        if doc.get("uploader_id") is None:
            doc = {**doc, "uploader_id": ""}
        return cls(**doc)


class SheetReportRequest(BaseModel):
    reason: str = Field(default="", max_length=300)


class SheetReport(BaseModel):
    """Signalement d'une fiche (contenu faux, hors-sujet, doublon…)."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sheet_id: str
    sheet_title: str = ""
    user_id: str
    user_name: str = ""
    reason: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class SheetReportOut(BaseModel):
    id: str
    sheet_id: str
    sheet_title: str = ""
    user_name: str = ""
    reason: str = ""
    created_at: datetime


class UnlockRequest(BaseModel):
    code: str


class UnlockStatus(BaseModel):
    unlocked: bool
