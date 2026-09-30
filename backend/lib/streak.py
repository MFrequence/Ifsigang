"""Série de jours (streak) : un jour compte quand TOUTES les révisions dues ont été faites.

La complétion est enregistrée au moment de la réponse (collection `revision_days`) :
impossible de la recalculer après coup, puisque les échéances passées ont été déplacées.
Dates toujours ancrées serveur via lib/dates.today_iso().
"""

from datetime import date, timedelta

from lib.dates import today_iso
from lib.db import db

WINDOW_DAYS = 7


async def remaining_due(user_id: str, today: str) -> int:
    """Cartes encore dues (aujourd'hui ou en retard) rattachées à une fiche existante."""
    schedules = await db.card_schedules.find(
        {"user_id": user_id, "due_date": {"$lte": today}}
    ).to_list(10000)
    if not schedules:
        return 0
    sheet_ids = list({s["sheet_id"] for s in schedules})
    sheets = await db.sheets.find({"id": {"$in": sheet_ids}}, {"id": 1}).to_list(1000)
    live = {s["id"] for s in sheets}
    return sum(1 for s in schedules if s["sheet_id"] in live)


async def mark_day_if_cleared(user_id: str) -> bool:
    """Après une réponse : si plus rien n'est dû, le jour est validé. Idempotent."""
    today = today_iso()
    if await remaining_due(user_id, today) > 0:
        return False
    await db.revision_days.update_one(
        {"user_id": user_id, "date": today},
        {"$set": {"user_id": user_id, "date": today}},
        upsert=True,
    )
    return True


def _streak_from(days: set[str], today: str) -> int:
    """Longueur de la série courante : aujourd'hui (ou hier si pas encore validé) en arrière."""
    base = date.fromisoformat(today)
    if today not in days:
        base -= timedelta(days=1)
        if base.isoformat() not in days:
            return 0
    count = 0
    while base.isoformat() in days:
        count += 1
        base -= timedelta(days=1)
    return count


def _best_from(days: set[str]) -> int:
    best = 0
    run = 0
    previous: date | None = None
    for iso in sorted(days):
        current = date.fromisoformat(iso)
        run = run + 1 if previous is not None and (current - previous).days == 1 else 1
        best = max(best, run)
        previous = current
    return best


async def compute_streak(user_id: str) -> dict:
    docs = await db.revision_days.find({"user_id": user_id}).to_list(5000)
    days = {d["date"] for d in docs}
    today = today_iso()
    base = date.fromisoformat(today)

    window = []
    for offset in range(WINDOW_DAYS - 1, -1, -1):
        day = base - timedelta(days=offset)
        iso = day.isoformat()
        window.append({"date": iso, "completed": iso in days, "is_today": iso == today})

    return {
        "today": today,
        "current": _streak_from(days, today),
        "best": _best_from(days),
        "completed_today": today in days,
        "remaining_today": await remaining_due(user_id, today),
        "total_days": len(days),
        "days": window,
    }
