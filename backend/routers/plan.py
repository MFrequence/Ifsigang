"""Planning de révisions avant partiel : création, suivi et avancement.

Le programme est recalculé à chaque lecture depuis les fiches du domaine/UE : les fiches
déposées après la création du planning y entrent automatiquement.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pymongo import ASCENDING

from lib.db import db
from lib.dates import today_iso
from lib.plan import parse_iso, schedule
from models.plan import PlanCreate, PlanDay, PlanOut, PlanSheet, RevisionPlan
from models.sheet import DOMAINS
from routers.auth import current_user

router = APIRouter(prefix="/plans", tags=["plans"])


async def _build(plan: dict) -> PlanOut:
    query: dict = {"domain": plan["domain"]}
    if plan.get("unit"):
        query["unit"] = plan["unit"]
    sheets = await db.sheets.find(query).sort("created_at", ASCENDING).to_list(500)
    by_id = {s["id"]: s for s in sheets}
    done = set(plan.get("done_sheet_ids") or [])

    today = today_iso()
    days = [
        PlanDay(
            date=day["date"],
            label=day["label"],
            is_today=day["is_today"],
            is_past=day["is_past"],
            is_review=day["is_review"],
            sheets=[
                PlanSheet(
                    id=sid,
                    title=by_id[sid].get("title", ""),
                    unit=by_id[sid].get("unit") or "",
                    mime=by_id[sid].get("mime", ""),
                    done=sid in done,
                )
                for sid in day["sheet_ids"]
                if sid in by_id
            ],
        )
        for day in schedule(list(by_id), today, plan["exam_date"])
    ]

    exam = parse_iso(plan["exam_date"])
    anchor = parse_iso(today)
    days_left = max((exam - anchor).days, 0) if exam and anchor else 0
    cards_total = (
        await db.flashcards.count_documents({"sheet_id": {"$in": list(by_id)}}) if by_id else 0
    )

    return PlanOut(
        id=plan["id"],
        title=plan["title"],
        domain=plan["domain"],
        unit=plan.get("unit") or "",
        exam_date=plan["exam_date"],
        days_left=days_left,
        total_sheets=len(by_id),
        done_count=len([sid for sid in by_id if sid in done]),
        cards_total=cards_total,
        days=days,
    )


async def _own_or_404(plan_id: str, user_id: str) -> dict:
    plan = await db.revision_plans.find_one({"id": plan_id, "user_id": user_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Planning introuvable")
    return plan


@router.get("", response_model=list[PlanOut])
async def list_plans(user: dict = Depends(current_user)):
    """Les plannings de l'étudiant, épreuve la plus proche en tête."""
    docs = await db.revision_plans.find({"user_id": user["id"]}).to_list(100)
    docs.sort(key=lambda p: p["exam_date"])
    return [await _build(doc) for doc in docs]


@router.post("", response_model=PlanOut, status_code=201)
async def create_plan(payload: PlanCreate, user: dict = Depends(current_user)):
    if payload.domain not in DOMAINS:
        raise HTTPException(status_code=422, detail="Domaine inconnu")
    exam = parse_iso(payload.exam_date)
    if exam is None:
        raise HTTPException(status_code=422, detail="Date d'épreuve invalide (AAAA-MM-JJ)")
    if payload.exam_date < today_iso():
        raise HTTPException(status_code=422, detail="La date de l'épreuve est déjà passée")

    plan = RevisionPlan(
        user_id=user["id"],
        title=payload.title.strip()[:120],
        domain=payload.domain,
        unit=payload.unit.strip()[:40],
        exam_date=payload.exam_date,
    )
    await db.revision_plans.insert_one(plan.model_dump())
    return await _build(plan.model_dump())


@router.post("/{plan_id}/sheets/{sheet_id}/toggle", response_model=PlanOut)
async def toggle_sheet(plan_id: str, sheet_id: str, user: dict = Depends(current_user)):
    """Coche / décoche une fiche du programme (avancement personnel)."""
    plan = await _own_or_404(plan_id, user["id"])
    done = set(plan.get("done_sheet_ids") or [])
    done.symmetric_difference_update({sheet_id})
    await db.revision_plans.update_one(
        {"id": plan_id}, {"$set": {"done_sheet_ids": sorted(done)}}
    )
    return await _build({**plan, "done_sheet_ids": sorted(done)})


@router.delete("/{plan_id}", status_code=204)
async def delete_plan(plan_id: str, user: dict = Depends(current_user)):
    await _own_or_404(plan_id, user["id"])
    await db.revision_plans.delete_one({"id": plan_id})
    return Response(status_code=204)
