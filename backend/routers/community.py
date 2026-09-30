"""Surlignages personnels + entraide de promo (questions/réponses) sur une fiche.

Un surlignage appartient à son auteur seul ; les questions et réponses sont visibles de
toute la promo. La « meilleure réponse » est choisie par l'auteur de la question.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pymongo import ASCENDING

from lib.db import db
from models.community import (
    Answer,
    AnswerCreate,
    AnswerOut,
    Highlight,
    HighlightCreate,
    HighlightOut,
    Question,
    QuestionCreate,
    QuestionOut,
)
from routers.auth import current_user

router = APIRouter(tags=["community"])


async def _sheet_or_404(sheet_id: str) -> dict:
    doc = await db.sheets.find_one({"id": sheet_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Fiche introuvable")
    return doc


# ---------------------------------------------------------------- surlignages


@router.get("/sheets/{sheet_id}/highlights", response_model=list[HighlightOut])
async def list_highlights(sheet_id: str, user: dict = Depends(current_user)):
    docs = (
        await db.sheet_highlights.find({"sheet_id": sheet_id, "user_id": user["id"]})
        .sort("created_at", ASCENDING)
        .to_list(300)
    )
    return [HighlightOut(**doc) for doc in docs]


@router.post("/sheets/{sheet_id}/highlights", response_model=HighlightOut, status_code=201)
async def add_highlight(
    sheet_id: str, payload: HighlightCreate, user: dict = Depends(current_user)
):
    await _sheet_or_404(sheet_id)
    text = " ".join(payload.text.split())[:600]
    if len(text) < 3:
        raise HTTPException(status_code=422, detail="Sélection trop courte")
    existing = await db.sheet_highlights.find_one(
        {"sheet_id": sheet_id, "user_id": user["id"], "text": text}
    )
    if existing:  # idempotent : re-surligner le même passage ne crée pas de doublon
        return HighlightOut(**existing)
    highlight = Highlight(user_id=user["id"], sheet_id=sheet_id, text=text)
    await db.sheet_highlights.insert_one(highlight.model_dump())
    return HighlightOut(**highlight.model_dump())


@router.delete("/sheets/{sheet_id}/highlights/{highlight_id}", status_code=204)
async def delete_highlight(
    sheet_id: str, highlight_id: str, user: dict = Depends(current_user)
):
    result = await db.sheet_highlights.delete_one(
        {"id": highlight_id, "sheet_id": sheet_id, "user_id": user["id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Surlignage introuvable")
    return Response(status_code=204)


# ------------------------------------------------------------------- entraide


@router.get("/sheets/questions/counts", response_model=dict[str, int])
async def question_counts(_: dict = Depends(current_user)):
    """Nombre de questions par fiche — un seul appel pour toute la bibliothèque."""
    pipeline = [{"$group": {"_id": "$sheet_id", "n": {"$sum": 1}}}]
    return {doc["_id"]: doc["n"] async for doc in db.sheet_questions.aggregate(pipeline)}


@router.get("/sheets/{sheet_id}/questions", response_model=list[QuestionOut])
async def list_questions(sheet_id: str, user: dict = Depends(current_user)):
    questions = (
        await db.sheet_questions.find({"sheet_id": sheet_id})
        .sort("created_at", ASCENDING)
        .to_list(300)
    )
    if not questions:
        return []
    answers = (
        await db.sheet_answers.find({"question_id": {"$in": [q["id"] for q in questions]}})
        .sort("created_at", ASCENDING)
        .to_list(2000)
    )
    by_question: dict[str, list[AnswerOut]] = {}
    for answer in answers:
        by_question.setdefault(answer["question_id"], []).append(
            AnswerOut(
                id=answer["id"],
                author=answer.get("author", ""),
                body=answer["body"],
                best=bool(answer.get("best")),
                mine=answer["user_id"] == user["id"],
                created_at=answer["created_at"],
            )
        )
    # La meilleure réponse remonte en tête.
    for items in by_question.values():
        items.sort(key=lambda a: (not a.best, a.created_at))

    return [
        QuestionOut(
            id=q["id"],
            author=q.get("author", ""),
            body=q["body"],
            mine=q["user_id"] == user["id"],
            created_at=q["created_at"],
            answers=by_question.get(q["id"], []),
        )
        for q in questions
    ]


@router.post("/sheets/{sheet_id}/questions", response_model=QuestionOut, status_code=201)
async def add_question(
    sheet_id: str, payload: QuestionCreate, user: dict = Depends(current_user)
):
    await _sheet_or_404(sheet_id)
    question = Question(
        sheet_id=sheet_id,
        user_id=user["id"],
        author=user["name"],
        body=payload.body.strip()[:800],
    )
    await db.sheet_questions.insert_one(question.model_dump())
    return QuestionOut(**question.model_dump(), mine=True, answers=[])


@router.delete("/questions/{question_id}", status_code=204)
async def delete_question(question_id: str, user: dict = Depends(current_user)):
    """Chacun supprime ses propres questions (les réponses suivent)."""
    question = await db.sheet_questions.find_one({"id": question_id})
    if not question:
        raise HTTPException(status_code=404, detail="Question introuvable")
    if question["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Seul l'auteur peut supprimer sa question")
    await db.sheet_questions.delete_one({"id": question_id})
    await db.sheet_answers.delete_many({"question_id": question_id})
    return Response(status_code=204)


@router.post("/questions/{question_id}/answers", response_model=AnswerOut, status_code=201)
async def add_answer(
    question_id: str, payload: AnswerCreate, user: dict = Depends(current_user)
):
    question = await db.sheet_questions.find_one({"id": question_id})
    if not question:
        raise HTTPException(status_code=404, detail="Question introuvable")
    answer = Answer(
        question_id=question_id,
        sheet_id=question["sheet_id"],
        user_id=user["id"],
        author=user["name"],
        body=payload.body.strip()[:1500],
    )
    await db.sheet_answers.insert_one(answer.model_dump())
    return AnswerOut(**answer.model_dump(), mine=True)


@router.post("/answers/{answer_id}/best", response_model=AnswerOut)
async def mark_best(answer_id: str, user: dict = Depends(current_user)):
    """L'auteur de la question désigne (ou retire) la meilleure réponse."""
    answer = await db.sheet_answers.find_one({"id": answer_id})
    if not answer:
        raise HTTPException(status_code=404, detail="Réponse introuvable")
    question = await db.sheet_questions.find_one({"id": answer["question_id"]})
    if not question or question["user_id"] != user["id"]:
        raise HTTPException(
            status_code=403, detail="Seul l'auteur de la question choisit la meilleure réponse"
        )
    best = not bool(answer.get("best"))
    # Une seule meilleure réponse par question.
    await db.sheet_answers.update_many(
        {"question_id": answer["question_id"]}, {"$set": {"best": False}}
    )
    if best:
        await db.sheet_answers.update_one({"id": answer_id}, {"$set": {"best": True}})
    return AnswerOut(
        id=answer["id"],
        author=answer.get("author", ""),
        body=answer["body"],
        best=best,
        mine=answer["user_id"] == user["id"],
        created_at=answer["created_at"],
    )
