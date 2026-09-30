"""Criterion: GET /api/revision/plan returns a coherent shape (due_today, new_available,
scheduled, mastered, total_cards + 7 upcoming entries) once at least one card is scheduled.
"""

import httpx
import pytest

from .conftest import api_url


@pytest.fixture
def marc_session():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": "marc.dupont@ifsi.fr", "password": "Promo2026!"})
        assert r.status_code == 200, r.text
        yield c


def test_revision_plan_shape_after_answering(marc_session):
    c = marc_session

    deck = c.get("/study/deck", params={"domain": "E"})
    assert deck.status_code == 200, deck.text
    cards = deck.json()
    assert len(cards) > 0
    card_id = cards[0]["id"]

    r = c.post("/progress/answer", json={"card_id": card_id, "correct": True, "mode": "flash"})
    assert r.status_code == 201, r.text

    plan = c.get("/revision/plan")
    assert plan.status_code == 200, plan.text
    body = plan.json()

    for key in ("today", "due_today", "new_available", "scheduled", "mastered", "total_cards", "upcoming"):
        assert key in body, body

    assert body["scheduled"] >= 1, body
    assert body["total_cards"] >= body["scheduled"], body
    assert len(body["upcoming"]) == 7, body["upcoming"]
    for day in body["upcoming"]:
        assert "date" in day and "count" in day
        assert day["count"] >= 0
