"""Entraînement aux calculs de doses : génération, correction détaillée, statistiques."""

import uuid

from fastapi import APIRouter, Depends, HTTPException

from lib.calc import EXERCISE_TYPES, generate, is_correct
from lib.db import db
from models.calc import (
    CalcAnswerRequest,
    CalcAnswerResult,
    CalcAttempt,
    CalcExercise,
    CalcSprint,
    CalcSprintEntry,
    CalcSprintRequest,
    CalcStats,
)
from routers.auth import current_user

router = APIRouter(prefix="/calc", tags=["calc"])


@router.get("/types", response_model=dict[str, str])
async def types(_: dict = Depends(current_user)):
    return EXERCISE_TYPES


@router.get("/exercise", response_model=CalcExercise)
async def new_exercise(
    type: str | None = None,
    avoid: str | None = None,
    user: dict = Depends(current_user),
):
    """`avoid` : famille à ne pas retirer deux fois de suite (moins de répétitions)."""
    if type and type not in EXERCISE_TYPES:
        raise HTTPException(status_code=422, detail="Type d'exercice inconnu")
    exercise = generate(type, avoid=avoid)
    exercise_id = str(uuid.uuid4())
    # La réponse et les étapes restent côté serveur jusqu'à la validation.
    await db.calc_exercises.insert_one({"id": exercise_id, "user_id": user["id"], **exercise})
    return CalcExercise(
        id=exercise_id,
        type=exercise["type"],
        label=exercise["label"],
        statement=exercise["statement"],
        unit=exercise["unit"],
    )


@router.post("/answer", response_model=CalcAnswerResult)
async def answer(payload: CalcAnswerRequest, user: dict = Depends(current_user)):
    exercise = await db.calc_exercises.find_one(
        {"id": payload.exercise_id, "user_id": user["id"]}
    )
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercice introuvable")

    correct = is_correct(exercise["answer"], payload.answer, exercise.get("tolerance", 0.05))
    await db.calc_attempts.insert_one(
        CalcAttempt(
            user_id=user["id"],
            exercise_id=payload.exercise_id,
            type=exercise["type"],
            correct=correct,
            given=payload.answer,
            expected=exercise["answer"],
        ).model_dump()
    )

    recent = (
        await db.calc_attempts.find({"user_id": user["id"]})
        .sort("created_at", -1)
        .to_list(50)
    )
    streak = 0
    for attempt in recent:
        if attempt["correct"]:
            streak += 1
        else:
            break

    return CalcAnswerResult(
        correct=correct,
        expected=exercise["answer"],
        unit=exercise["unit"],
        steps=exercise["steps"],
        streak=streak,
    )


@router.post("/sprint", response_model=CalcSprintEntry, status_code=201)
async def save_sprint(payload: CalcSprintRequest, user: dict = Depends(current_user)):
    """Résultat d'un mode chronométré (10 calculs en 5 minutes)."""
    if payload.score > payload.total:
        raise HTTPException(status_code=422, detail="Score supérieur au nombre d'exercices")
    sprint = CalcSprint(
        user_id=user["id"], score=payload.score, total=payload.total, seconds=payload.seconds
    )
    await db.calc_sprints.insert_one(sprint.model_dump())
    return CalcSprintEntry(
        score=sprint.score,
        total=sprint.total,
        seconds=sprint.seconds,
        created_at=sprint.created_at,
    )


@router.get("/sprints", response_model=list[CalcSprintEntry])
async def sprint_history(user: dict = Depends(current_user)):
    docs = (
        await db.calc_sprints.find({"user_id": user["id"]})
        .sort("created_at", -1)
        .to_list(20)
    )
    return [CalcSprintEntry(**{k: d[k] for k in ("score", "total", "seconds", "created_at")}) for d in docs]


@router.get("/stats", response_model=CalcStats)
async def stats(user: dict = Depends(current_user)):
    attempts = await db.calc_attempts.find({"user_id": user["id"]}).to_list(5000)
    ok = sum(1 for a in attempts if a["correct"])
    per_type: dict[str, int] = {}
    for attempt in attempts:
        if attempt["correct"]:
            per_type[attempt["type"]] = per_type.get(attempt["type"], 0) + 1
    return CalcStats(
        answered=len(attempts),
        correct=ok,
        accuracy=round(ok / len(attempts) * 100) if attempts else 0,
        per_type=per_type,
    )
