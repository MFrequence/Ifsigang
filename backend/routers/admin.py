"""Espace admin : liste des comptes de la promo et suppression complète d'un compte.

Déverrouillage par mot de passe dédié (`ADMIN_PASSWORD` dans backend/.env) : le flag est
posé sur la session en cours, jamais côté frontend.
"""

import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request

from lib.db import db
from models.admin import AdminStatus, AdminUnlockRequest, AdminUser
from routers.auth import COOKIE_NAME, current_user

router = APIRouter(prefix="/admin", tags=["admin"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"


def _admin_password() -> str:
    return os.environ.get("ADMIN_PASSWORD", "").strip()


async def _session_of(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    session = await db.sessions.find_one({"token": token}) if token else None
    if not session:
        raise HTTPException(status_code=401, detail="Connexion requise")
    return session


async def admin_guard(request: Request, _: dict = Depends(current_user)) -> dict:
    """Session étudiante valide ET espace admin déverrouillé."""
    session = await _session_of(request)
    if not session.get("is_admin"):
        raise HTTPException(status_code=403, detail="Espace admin verrouillé")
    return session


@router.get("/status", response_model=AdminStatus)
async def admin_status(request: Request, _: dict = Depends(current_user)):
    session = await _session_of(request)
    return AdminStatus(is_admin=bool(session.get("is_admin")), configured=bool(_admin_password()))


@router.post("/unlock", response_model=AdminStatus)
async def admin_unlock(
    payload: AdminUnlockRequest, request: Request, _: dict = Depends(current_user)
):
    expected = _admin_password()
    if not expected:
        raise HTTPException(status_code=503, detail="Aucun mot de passe admin configuré")
    if payload.password != expected:
        raise HTTPException(status_code=403, detail="Mot de passe admin incorrect")
    session = await _session_of(request)
    await db.sessions.update_one({"token": session["token"]}, {"$set": {"is_admin": True}})
    return AdminStatus(is_admin=True, configured=True)


@router.post("/lock", response_model=AdminStatus)
async def admin_lock(request: Request, _: dict = Depends(current_user)):
    session = await _session_of(request)
    await db.sessions.update_one({"token": session["token"]}, {"$set": {"is_admin": False}})
    return AdminStatus(is_admin=False, configured=bool(_admin_password()))


@router.get("/users", response_model=list[AdminUser])
async def list_users(session: dict = Depends(admin_guard)):
    users = await db.users.find({}).to_list(1000)
    sheets = await db.sheets.find({}, {"uploader_id": 1}).to_list(5000)
    results = await db.card_results.find({}, {"user_id": 1}).to_list(50000)

    uploads: dict[str, int] = {}
    for s in sheets:
        owner = s.get("uploader_id")
        if owner:
            uploads[owner] = uploads.get(owner, 0) + 1
    answers: dict[str, int] = {}
    for r in results:
        answers[r["user_id"]] = answers.get(r["user_id"], 0) + 1

    entries = [
        AdminUser(
            id=u["id"],
            name=u["name"],
            email=u["email"],
            created_at=u.get("created_at"),
            sheets=uploads.get(u["id"], 0),
            answers=answers.get(u["id"], 0),
            is_me=u["id"] == session["user_id"],
        )
        for u in users
    ]
    entries.sort(key=lambda e: e.name.casefold())
    return entries


@router.delete("/users/{user_id}", status_code=200)
async def delete_user(user_id: str, session: dict = Depends(admin_guard)):
    """Suppression totale : fiches (et fichiers disque), flashcards, progression, sessions."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    if user_id == session["user_id"]:
        raise HTTPException(
            status_code=400, detail="Tu ne peux pas supprimer le compte avec lequel tu es connecté"
        )

    sheets = await db.sheets.find({"uploader_id": user_id}).to_list(5000)
    sheet_ids = [s["id"] for s in sheets]
    for sheet in sheets:
        stored = sheet.get("stored_name")
        if stored:
            path = UPLOADS_DIR / stored
            if path.is_file():
                path.unlink(missing_ok=True)

    if sheet_ids:
        await db.sheets.delete_many({"id": {"$in": sheet_ids}})
        await db.flashcards.delete_many({"sheet_id": {"$in": sheet_ids}})
        await db.card_results.delete_many({"sheet_id": {"$in": sheet_ids}})
        await db.card_schedules.delete_many({"sheet_id": {"$in": sheet_ids}})
        await db.card_reports.delete_many({"sheet_id": {"$in": sheet_ids}})

    await db.card_results.delete_many({"user_id": user_id})
    await db.card_schedules.delete_many({"user_id": user_id})
    await db.card_reports.delete_many({"user_id": user_id})
    await db.revision_days.delete_many({"user_id": user_id})
    await db.sessions.delete_many({"user_id": user_id})
    await db.users.delete_one({"id": user_id})

    return {"deleted": True, "user_id": user_id, "sheets_deleted": len(sheet_ids)}
