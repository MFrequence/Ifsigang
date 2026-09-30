"""Espace admin : déverrouillage par mot de passe dédié et gestion des comptes."""

from datetime import datetime

from pydantic import BaseModel, Field


class AdminUnlockRequest(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class AdminStatus(BaseModel):
    is_admin: bool
    configured: bool  # un mot de passe admin est défini côté serveur


class TemporaryPassword(BaseModel):
    user_id: str
    email: str
    temporary_password: str


class AdminUser(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime | None = None
    sheets: int = 0
    answers: int = 0
    is_me: bool = False
