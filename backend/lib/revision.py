"""Méthode des J : planification par répétition espacée.

Paliers classiques en IFSI/PASS : J0 (apprentissage), puis J1, J3, J7, J15, J30.
Réponse juste → on monte d'un palier ; réponse fausse → retour à J1 (l'intervalle est
resserré, conformément à la méthode : une notion oubliée doit être revue vite).
"""

from datetime import date, timedelta

from lib.dates import today_iso
from lib.db import db
from models.revision import CardSchedule

# Index = level. Le level 0 est l'entrée dans le cycle (à réviser le jour même).
J_INTERVALS: list[int] = [0, 1, 3, 7, 15, 30]
MAX_LEVEL = len(J_INTERVALS) - 1


def stage_label(level: int) -> str:
    """Libellé du palier, ex. 'J7'. Borné au dernier palier."""
    return f"J{J_INTERVALS[min(max(level, 0), MAX_LEVEL)]}"


# Auto-évaluation : "easy" monte d'un palier, "medium" ramène à J3, "hard" à J1.
QUALITIES = ("easy", "medium", "hard")
MEDIUM_LEVEL = 2  # J3


def next_level(level: int, correct: bool, quality: str | None = None) -> int:
    if quality == "medium":
        # notion fragile : la carte revient à J3, qu'elle vienne d'un palier plus haut ou plus bas
        return MEDIUM_LEVEL
    if quality == "hard" or not correct:
        return 1  # retour à J1 : revue dès le lendemain
    return min(level + 1, MAX_LEVEL)


def due_date_for(level: int, from_date: str) -> str:
    """Échéance = date de référence + intervalle du palier (dates ancrées serveur)."""
    base = date.fromisoformat(from_date)
    return (base + timedelta(days=J_INTERVALS[min(max(level, 0), MAX_LEVEL)])).isoformat()


async def apply_answer(
    user_id: str, card_id: str, sheet_id: str, correct: bool, quality: str | None = None
) -> dict:
    """Met à jour (ou crée) l'échéance d'une carte après une réponse. Renvoie le nouvel état."""
    today = today_iso()
    existing = await db.card_schedules.find_one({"user_id": user_id, "card_id": card_id})
    current_level = existing.get("level", 0) if existing else 0

    level = next_level(current_level, correct, quality)
    schedule = CardSchedule(
        user_id=user_id,
        card_id=card_id,
        sheet_id=sheet_id,
        level=level,
        due_date=due_date_for(level, today),
        reviews=(existing.get("reviews", 0) if existing else 0) + 1,
        lapses=(existing.get("lapses", 0) if existing else 0) + (0 if correct else 1),
    )
    payload = schedule.model_dump()
    if existing:
        payload.pop("id", None)  # on ne réécrit jamais l'identifiant d'un document existant
        await db.card_schedules.update_one(
            {"user_id": user_id, "card_id": card_id}, {"$set": payload}
        )
    else:
        await db.card_schedules.insert_one(payload)
    return payload
