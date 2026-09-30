"""Schémas d'anatomie à compléter : liste, énoncé et correction serveur."""

import random
import unicodedata

from fastapi import APIRouter, Depends, HTTPException

from lib.anatomy import DIAGRAM_MAP, DIAGRAMS
from lib.db import db
from models.anatomy import (
    DiagramAttempt,
    DiagramAttemptRequest,
    DiagramAttemptResult,
    DiagramExercise,
    DiagramSummary,
)
from routers.auth import current_user

router = APIRouter(prefix="/anatomy", tags=["anatomy"])


def _normalize(value: str) -> str:
    stripped = unicodedata.normalize("NFD", value.strip().casefold())
    return "".join(c for c in stripped if unicodedata.category(c) != "Mn")


@router.get("", response_model=list[DiagramSummary])
async def list_diagrams(user: dict = Depends(current_user)):
    attempts = await db.anatomy_attempts.find({"user_id": user["id"]}).to_list(2000)
    best: dict[str, int] = {}
    counts: dict[str, int] = {}
    for attempt in attempts:
        slug = attempt["slug"]
        best[slug] = max(best.get(slug, 0), attempt["score"])
        counts[slug] = counts.get(slug, 0) + 1

    return [
        DiagramSummary(
            slug=d["slug"],
            title=d["title"],
            system=d["system"],
            hint=d["hint"],
            image_url=d["image_url"],
            marker_count=len(d["markers"]),
            best_score=best.get(d["slug"], 0),
            attempts=counts.get(d["slug"], 0),
        )
        for d in DIAGRAMS
    ]


@router.get("/{slug}", response_model=DiagramExercise)
async def diagram(slug: str, _: dict = Depends(current_user)):
    d = DIAGRAM_MAP.get(slug)
    if not d:
        raise HTTPException(status_code=404, detail="Schéma introuvable")
    labels = list(d["markers"].values())
    random.shuffle(labels)
    return DiagramExercise(
        slug=d["slug"],
        title=d["title"],
        system=d["system"],
        hint=d["hint"],
        image_url=d["image_url"],
        numbers=sorted(d["markers"].keys()),
        labels=labels,
    )


@router.post("/{slug}/attempt", response_model=DiagramAttemptResult)
async def submit_attempt(
    slug: str, payload: DiagramAttemptRequest, user: dict = Depends(current_user)
):
    d = DIAGRAM_MAP.get(slug)
    if not d:
        raise HTTPException(status_code=404, detail="Schéma introuvable")

    markers: dict[int, str] = d["markers"]
    correct: list[int] = []
    for number, expected in markers.items():
        given = payload.answers.get(str(number), "")
        if given and _normalize(given) == _normalize(expected):
            correct.append(number)

    attempt = DiagramAttempt(
        user_id=user["id"], slug=slug, score=len(correct), total=len(markers)
    )
    await db.anatomy_attempts.insert_one(attempt.model_dump())

    previous = await db.anatomy_attempts.find({"user_id": user["id"], "slug": slug}).to_list(2000)
    return DiagramAttemptResult(
        slug=slug,
        score=len(correct),
        total=len(markers),
        correct_numbers=sorted(correct),
        solution={str(k): v for k, v in markers.items()},
        best_score=max((a["score"] for a in previous), default=len(correct)),
    )
