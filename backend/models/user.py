"""Comptes étudiants + sessions (cookie httpOnly). Mot de passe haché, jamais renvoyé."""

import uuid
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, EmailStr, Field

SESSION_DAYS = 30


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    password_hash: str
    must_change_password: bool = False  # vrai après une réinitialisation admin
    created_at: datetime = Field(default_factory=utcnow)


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    must_change_password: bool = False


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class SignupRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=6, max_length=128)
    invite_code: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Session(BaseModel):
    token: str = Field(default_factory=lambda: uuid.uuid4().hex + uuid.uuid4().hex)
    user_id: str
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime = Field(default_factory=lambda: utcnow() + timedelta(days=SESSION_DAYS))
