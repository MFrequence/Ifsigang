"""Promo-code gate: unlock (httpOnly cookie), status, lock. No accounts, one shared code."""

import os

from fastapi import APIRouter, HTTPException, Request, Response

from models.sheet import UnlockRequest, UnlockStatus

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "promo_access"
COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


def expected_code() -> str:
    return os.environ.get("ACCESS_CODE", "").strip()


def code_matches(candidate: str | None) -> bool:
    expected = expected_code()
    # Fail closed: no code configured means nobody gets in.
    return bool(expected) and bool(candidate) and candidate.strip().casefold() == expected.casefold()


async def require_access(request: Request) -> None:
    """Shared dependency: every protected route rides the promo-code cookie."""
    if not code_matches(request.cookies.get(COOKIE_NAME)):
        raise HTTPException(status_code=401, detail="Accès réservé à la promo — entre le code")


@router.post("/unlock", response_model=UnlockStatus)
async def unlock(payload: UnlockRequest, response: Response):
    if not code_matches(payload.code):
        raise HTTPException(status_code=401, detail="Code promo incorrect")
    response.set_cookie(
        COOKIE_NAME,
        expected_code(),
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return UnlockStatus(unlocked=True)


@router.get("/status", response_model=UnlockStatus)
async def status(request: Request):
    return UnlockStatus(unlocked=code_matches(request.cookies.get(COOKIE_NAME)))


@router.post("/lock", response_model=UnlockStatus)
async def lock(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return UnlockStatus(unlocked=False)
