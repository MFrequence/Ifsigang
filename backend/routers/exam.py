"""Examen blanc : démarrage, correction et historique."""

import random

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from models.exam import (
    EXAM_SIZE,
    Exam,
    ExamCorrection,
    ExamHistoryEntry,
    ExamOut,
    ExamQuestion,
    ExamResult,
    ExamResultOut,
    ExamSubmission,
)
from models.sheet import DOMAINS
from routers.auth import current_user

router = APIRouter(prefix="/exam", tags=["exam"])


@router.post("/start", response_model=ExamOut)
async def start(
    domain: str | None = None,
    unit: str | None = None,
    user: dict = Depends(current_user),
):
    """Tire au hasard jusqu'à 20 QCM parmi les fiches du périmètre demandé."""
    query: dict = {}
    if domain:
        if domain not in DOMAINS:
            raise HTTPException(status_code=422, detail="Domaine inconnu")
        query["domain"] = domain
    if unit:
        query["unit"] = unit

    sheets = await db.sheets.find(query).to_list(500)
    if not sheets:
        raise HTTPException(status_code=404, detail="Aucune fiche dans ce périmètre")
    by_id = {s["id"]: s for s in sheets}

    # Un QCM exige au moins un distracteur.
    cards = await db.flashcards.find(
        {"sheet_id": {"$in": list(by_id)}, "distractors.0": {"$exists": True}}
    ).to_list(3000)
    if not cards:
        raise HTTPException(
            status_code=404, detail="Pas encore de QCM disponibles dans ce périmètre"
        )

    picked = random.sample(cards, min(EXAM_SIZE, len(cards)))
    scope = (
        f"UE {unit}" if unit else f"Domaine {domain}" if domain else "Toutes les fiches"
    )

    questions: list[ExamQuestion] = []
    solutions: dict[str, str] = {}
    for card in picked:
        choices = [card["answer"], *(card.get("distractors") or [])][:4]
        random.shuffle(choices)
        sheet = by_id[card["sheet_id"]]
        solutions[card["id"]] = card["answer"]
        questions.append(
            ExamQuestion(
                card_id=card["id"],
                question=card["question"],
                choices=choices,
                sheet_title=sheet.get("title", ""),
                unit=sheet.get("unit") or "",
            )
        )

    exam = Exam(
        user_id=user["id"],
        scope=scope,
        domain=domain or "",
        unit=unit or "",
        solutions=solutions,
    )
    await db.exams.insert_one(exam.model_dump())
    return ExamOut(id=exam.id, scope=scope, total=len(questions), questions=questions)


@router.post("/{exam_id}/submit", response_model=ExamResultOut)
async def submit(exam_id: str, payload: ExamSubmission, user: dict = Depends(current_user)):
    exam = await db.exams.find_one({"id": exam_id, "user_id": user["id"]})
    if not exam:
        raise HTTPException(status_code=404, detail="Examen introuvable")

    solutions: dict[str, str] = exam["solutions"]
    cards = await db.flashcards.find({"id": {"$in": list(solutions)}}).to_list(100)
    questions = {c["id"]: c for c in cards}
    sheets = await db.sheets.find(
        {"id": {"$in": list({c["sheet_id"] for c in cards})}}
    ).to_list(200)
    titles = {s["id"]: s.get("title", "") for s in sheets}

    corrections: list[ExamCorrection] = []
    score = 0
    for card_id, expected in solutions.items():
        given = payload.answers.get(card_id, "")
        ok = given == expected
        score += 1 if ok else 0
        card = questions.get(card_id, {})
        corrections.append(
            ExamCorrection(
                card_id=card_id,
                question=card.get("question", ""),
                given=given,
                expected=expected,
                correct=ok,
                sheet_title=titles.get(card.get("sheet_id", ""), ""),
            )
        )

    total = len(solutions)
    await db.exam_results.insert_one(
        ExamResult(
            user_id=user["id"],
            exam_id=exam_id,
            scope=exam.get("scope", ""),
            score=score,
            total=total,
            seconds=max(0, payload.seconds),
        ).model_dump()
    )

    return ExamResultOut(
        id=exam_id,
        scope=exam.get("scope", ""),
        score=score,
        total=total,
        mark=round(score / total * 20, 1) if total else 0.0,
        seconds=max(0, payload.seconds),
        corrections=corrections,
    )


@router.get("/history", response_model=list[ExamHistoryEntry])
async def history(user: dict = Depends(current_user)):
    docs = (
        await db.exam_results.find({"user_id": user["id"]})
        .sort("created_at", -1)
        .to_list(30)
    )
    return [
        ExamHistoryEntry(
            scope=d.get("scope", ""),
            score=d["score"],
            total=d["total"],
            mark=round(d["score"] / d["total"] * 20, 1) if d["total"] else 0.0,
            seconds=d.get("seconds", 0),
            created_at=d["created_at"],
        )
        for d in docs
    ]
