"""Révision quotidienne (méthode des J) : paquet du jour et plan des prochains jours."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query

from lib.dates import today_iso
from lib.db import db
from lib.revision import MAX_LEVEL, next_level, stage_label
from lib.streak import compute_streak
from models.revision import DayLoad, RevisionCard, RevisionPlan, Streak
from routers.auth import current_user

router = APIRouter(prefix="/revision", tags=["revision"])

DEFAULT_LIMIT = 20
UPCOMING_DAYS = 7


async def _cards_with_context(card_ids: list[str] | None = None) -> tuple[list[dict], dict]:
    """Cartes (optionnellement filtrées) + index des fiches pour le contexte d'affichage."""
    query = {"id": {"$in": card_ids}} if card_ids is not None else {}
    cards = await db.flashcards.find(query).to_list(5000)
    sheet_ids = list({c["sheet_id"] for c in cards})
    sheets = await db.sheets.find({"id": {"$in": sheet_ids}}).to_list(1000)
    return cards, {s["id"]: s for s in sheets}


@router.get("/today", response_model=list[RevisionCard])
async def today_deck(
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=100),
    user: dict = Depends(current_user),
):
    """Paquet du jour : cartes en retard d'abord, puis échues aujourd'hui, puis nouvelles."""
    today = today_iso()
    schedules = await db.card_schedules.find({"user_id": user["id"]}).to_list(10000)
    by_card = {s["card_id"]: s for s in schedules}

    cards, sheets = await _cards_with_context()
    due: list[tuple[int, dict, dict | None]] = []
    fresh: list[tuple[int, dict, dict | None]] = []

    for card in cards:
        # Carte orpheline (fiche supprimée) : elle n'a plus de sens dans une révision.
        if card["sheet_id"] not in sheets:
            continue
        sched = by_card.get(card["id"])
        if sched is None:
            fresh.append((0, card, None))
            continue
        if sched["due_date"] <= today:
            overdue = (date.fromisoformat(today) - date.fromisoformat(sched["due_date"])).days
            due.append((overdue, card, sched))

    # Le plus en retard d'abord : c'est ce que la courbe de l'oubli rend le plus urgent.
    due.sort(key=lambda item: (-item[0], item[1].get("order", 0)))
    selected = due[:limit]
    if len(selected) < limit:
        selected += fresh[: limit - len(selected)]

    deck: list[RevisionCard] = []
    for overdue, card, sched in selected:
        sheet = sheets.get(card["sheet_id"], {})
        level = sched["level"] if sched else 0
        deck.append(
            RevisionCard(
                id=card["id"],
                sheet_id=card["sheet_id"],
                question=card["question"],
                answer=card["answer"],
                distractors=card.get("distractors") or [],
                order=card.get("order", 0),
                reports=card.get("reports", 0),
                sheet_title=sheet.get("title", ""),
                domain=sheet.get("domain", ""),
                unit=sheet.get("unit") or "",
                due=True,
                level=level,
                stage=stage_label(level),
                next_stage=stage_label(next_level(level, True)),
                is_new=sched is None,
                overdue_days=overdue,
            )
        )
    return deck


@router.get("/mistakes", response_model=list[RevisionCard])
async def mistakes_deck(
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=100),
    user: dict = Depends(current_user),
):
    """Cartes dont la DERNIÈRE réponse était fausse, toutes fiches confondues (les plus récentes d'abord)."""
    results = (
        await db.card_results.find({"user_id": user["id"]})
        .sort("answered_at", -1)
        .to_list(20000)
    )
    latest: dict[str, dict] = {}
    for result in results:  # déjà trié du plus récent au plus ancien
        latest.setdefault(result["card_id"], result)

    wrong_ids = [card_id for card_id, r in latest.items() if not r.get("correct")]
    if not wrong_ids:
        return []

    cards, sheets = await _cards_with_context(wrong_ids)
    by_id = {c["id"]: c for c in cards}
    schedules = await db.card_schedules.find(
        {"user_id": user["id"], "card_id": {"$in": wrong_ids}}
    ).to_list(10000)
    levels = {s["card_id"]: s["level"] for s in schedules}

    deck: list[RevisionCard] = []
    for card_id in wrong_ids:  # ordre = du ratage le plus récent au plus ancien
        card = by_id.get(card_id)
        if not card or card["sheet_id"] not in sheets:
            continue  # carte orpheline (fiche supprimée)
        sheet = sheets[card["sheet_id"]]
        level = levels.get(card_id, 0)
        deck.append(
            RevisionCard(
                id=card["id"],
                sheet_id=card["sheet_id"],
                question=card["question"],
                answer=card["answer"],
                distractors=card.get("distractors") or [],
                order=card.get("order", 0),
                reports=card.get("reports", 0),
                sheet_title=sheet.get("title", ""),
                domain=sheet.get("domain", ""),
                unit=sheet.get("unit") or "",
                due=True,
                level=level,
                stage=stage_label(level),
                overdue_days=0,
                is_new=False,
            )
        )
        if len(deck) >= limit:
            break
    return deck


@router.get("/streak", response_model=Streak)
async def my_streak(user: dict = Depends(current_user)):
    """Série de jours consécutifs où toutes les révisions dues ont été terminées."""
    return Streak(**await compute_streak(user["id"]))


@router.get("/plan", response_model=RevisionPlan)
async def revision_plan(user: dict = Depends(current_user)):
    today = today_iso()
    schedules = await db.card_schedules.find({"user_id": user["id"]}).to_list(10000)

    # On ne compte que les cartes rattachées à une fiche existante.
    cards, sheets = await _cards_with_context()
    live_card_ids = {c["id"] for c in cards if c["sheet_id"] in sheets}
    total_cards = len(live_card_ids)
    live_schedules = [s for s in schedules if s["card_id"] in live_card_ids]

    due_today = sum(1 for s in live_schedules if s["due_date"] <= today)
    mastered = sum(1 for s in live_schedules if s.get("level", 0) >= MAX_LEVEL)

    counts: dict[str, int] = {}
    for s in live_schedules:
        if s["due_date"] > today:
            counts[s["due_date"]] = counts.get(s["due_date"], 0) + 1

    base = date.fromisoformat(today)
    upcoming = [
        DayLoad(
            date=(base + timedelta(days=offset)).isoformat(),
            count=counts.get((base + timedelta(days=offset)).isoformat(), 0),
        )
        for offset in range(1, UPCOMING_DAYS + 1)
    ]

    return RevisionPlan(
        today=today,
        due_today=due_today,
        new_available=max(total_cards - len(live_schedules), 0),
        scheduled=len(live_schedules),
        mastered=mastered,
        total_cards=total_cards,
        upcoming=upcoming,
    )
