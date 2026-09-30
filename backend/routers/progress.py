"""Progression personnelle et classement de la promo (visible par tous)."""

from fastapi import APIRouter, Depends

from lib.db import db
from lib.revision import apply_answer
from lib.streak import mark_day_if_cleared
from models.progress import (
    AnswerRequest,
    CardResult,
    DomainProgress,
    LeaderboardEntry,
    ProgressStats,
)
from routers.auth import current_user

router = APIRouter(prefix="/progress", tags=["progress"])


def _pct(correct: int, total: int) -> int:
    return round(correct * 100 / total) if total else 0


@router.post("/answer", status_code=201)
async def record_answer(payload: AnswerRequest, user: dict = Depends(current_user)):
    """Enregistre une réponse. Carte inconnue → 201 sans effet (jamais une erreur bloquante)."""
    card = await db.flashcards.find_one({"id": payload.card_id})
    if not card:
        return {"recorded": False}
    sheet = await db.sheets.find_one({"id": card["sheet_id"]})
    result = CardResult(
        user_id=user["id"],
        card_id=payload.card_id,
        sheet_id=card["sheet_id"],
        domain=(sheet or {}).get("domain", ""),
        unit=(sheet or {}).get("unit") or "",
        correct=payload.correct,
        mode=payload.mode if payload.mode in {"flash", "quiz"} else "flash",
    )
    await db.card_results.insert_one(result.model_dump())
    # Chaque réponse fait avancer (ou reculer) la carte dans le cycle des J.
    schedule = await apply_answer(user["id"], payload.card_id, card["sheet_id"], payload.correct)
    # Série de jours : le jour est validé dès qu'il ne reste plus rien à réviser.
    day_completed = await mark_day_if_cleared(user["id"])
    return {
        "recorded": True,
        "level": schedule["level"],
        "due_date": schedule["due_date"],
        "day_completed": day_completed,
    }


@router.get("/me", response_model=ProgressStats)
async def my_progress(user: dict = Depends(current_user)):
    results = await db.card_results.find({"user_id": user["id"]}).to_list(5000)
    answered = len(results)
    correct = sum(1 for r in results if r.get("correct"))

    # Dernière réponse par carte → maîtrisée / à revoir.
    last_by_card: dict[str, dict] = {}
    for r in sorted(results, key=lambda x: x.get("answered_at") or 0):
        last_by_card[r["card_id"]] = r
    mastered = sum(1 for r in last_by_card.values() if r.get("correct"))
    to_review = sum(1 for r in last_by_card.values() if not r.get("correct"))

    days = {
        r["answered_at"].date().isoformat()
        for r in results
        if r.get("answered_at") is not None and hasattr(r["answered_at"], "date")
    }

    per_domain: list[DomainProgress] = []
    for key in ("A", "B", "C", "D", "E"):
        subset = [r for r in results if r.get("domain") == key]
        if not subset:
            continue
        ok = sum(1 for r in subset if r.get("correct"))
        per_domain.append(
            DomainProgress(domain=key, answered=len(subset), correct=ok, accuracy=_pct(ok, len(subset)))
        )

    return ProgressStats(
        answered=answered,
        correct=correct,
        accuracy=_pct(correct, answered),
        mastered=mastered,
        to_review=to_review,
        sessions_days=len(days),
        per_domain=per_domain,
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(user: dict = Depends(current_user)):
    users = await db.users.find({}).to_list(500)
    results = await db.card_results.find({}).to_list(20000)
    sheets = await db.sheets.find({}, {"uploader_id": 1}).to_list(2000)

    uploads: dict[str, int] = {}
    for s in sheets:
        owner = s.get("uploader_id")
        if owner:
            uploads[owner] = uploads.get(owner, 0) + 1

    totals: dict[str, list[int]] = {}
    for r in results:
        stat = totals.setdefault(r["user_id"], [0, 0])
        stat[0] += 1
        if r.get("correct"):
            stat[1] += 1

    entries = [
        LeaderboardEntry(
            user_id=u["id"],
            name=u["name"],
            answered=totals.get(u["id"], [0, 0])[0],
            correct=totals.get(u["id"], [0, 0])[1],
            accuracy=_pct(totals.get(u["id"], [0, 0])[1], totals.get(u["id"], [0, 0])[0]),
            sheets_uploaded=uploads.get(u["id"], 0),
            is_me=u["id"] == user["id"],
        )
        for u in users
    ]
    entries.sort(key=lambda e: (-e.correct, -e.sheets_uploaded, e.name))
    return entries[:50]
