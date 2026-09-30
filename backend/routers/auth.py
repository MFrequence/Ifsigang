"""Auth par comptes : inscription (code d'invitation de la promo), connexion, session, moi.

La session est un cookie httpOnly opaque adossé à la collection `sessions` — aucun token
n'est renvoyé en JSON, aucun token n'est manipulé côté frontend.
"""

import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.db import db
from lib.security import hash_password, verify_password
from models.user import (
    SESSION_DAYS,
    ChangePasswordRequest,
    LoginRequest,
    Session,
    SignupRequest,
    User,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "session"
COOKIE_MAX_AGE = 60 * 60 * 24 * SESSION_DAYS


def invite_code() -> str:
    return os.environ.get("ACCESS_CODE", "").strip()


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        path="/",
    )


async def _open_session(response: Response, user_id: str) -> None:
    session = Session(user_id=user_id)
    await db.sessions.insert_one(session.model_dump())
    _set_session_cookie(response, session.token)


def _out(user: dict) -> UserOut:
    return UserOut(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        must_change_password=bool(user.get("must_change_password")),
    )


async def current_user(request: Request) -> dict:
    """Dépendance partagée : résout le cookie de session en utilisateur, sinon 401."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Connexion requise")
    session = await db.sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Session expirée — reconnecte-toi")
    expires = session.get("expires_at")
    if isinstance(expires, datetime):
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            await db.sessions.delete_one({"token": token})
            raise HTTPException(status_code=401, detail="Session expirée — reconnecte-toi")
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="Compte introuvable")
    return user


@router.post("/signup", response_model=UserOut, status_code=201)
async def signup(payload: SignupRequest, response: Response):
    expected = invite_code()
    if not expected or payload.invite_code.strip().casefold() != expected.casefold():
        raise HTTPException(status_code=403, detail="Code d'invitation de la promo incorrect")

    email = payload.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Un compte existe déjà avec cet email")

    user = User(
        email=email,
        name=payload.name.strip()[:80],
        password_hash=hash_password(payload.password),
    )
    await db.users.insert_one(user.model_dump())
    await _open_session(response, user.id)
    return UserOut(id=user.id, email=user.email, name=user.name)


@router.post("/login", response_model=UserOut)
async def login(payload: LoginRequest, response: Response):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    await _open_session(response, user["id"])
    return _out(user)


@router.get("/me", response_model=UserOut)
async def me(request: Request):
    user = await current_user(request)
    return _out(user)


@router.post("/change-password", response_model=UserOut)
async def change_password(payload: ChangePasswordRequest, user: dict = Depends(current_user)):
    """Changement de mot de passe par le titulaire du compte (mot de passe actuel exigé)."""
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=403, detail="Mot de passe actuel incorrect")
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=422, detail="Choisis un mot de passe différent")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": hash_password(payload.new_password),
            "must_change_password": False,
        }},
    )
    return _out({**user, "must_change_password": False})


@router.post("/logout", status_code=204)
async def logout(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        await db.sessions.delete_one({"token": token})
    # Le cookie doit être effacé sur la réponse RENVOYÉE : renvoyer un nouveau Response
    # après avoir écrit sur un `response: Response` injecté jetterait l'en-tête Set-Cookie.
    response = Response(status_code=204)
    response.delete_cookie(COOKIE_NAME, path="/")
    return response
