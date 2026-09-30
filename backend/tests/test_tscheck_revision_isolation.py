"""Criterion: J-method scheduling is isolated per user — one account answering cards must
not change another account's /revision/plan scheduled count.
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


@pytest.fixture
def sarah_session():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": "sarah.kaddour@ifsi.fr", "password": "Promo2026!"})
        assert r.status_code == 200, r.text
        yield c


def test_revision_plan_isolated_per_user(marc_session, sarah_session):
    sarah_before = sarah_session.get("/revision/plan")
    assert sarah_before.status_code == 200, sarah_before.text
    sarah_scheduled_before = sarah_before.json()["scheduled"]

    deck = marc_session.get("/study/deck", params={"domain": "E"})
    assert deck.status_code == 200, deck.text
    cards = deck.json()
    assert len(cards) > 0
    card_id = cards[0]["id"]

    answer = marc_session.post(
        "/progress/answer", json={"card_id": card_id, "correct": True, "mode": "flash"}
    )
    assert answer.status_code == 201, answer.text

    marc_plan = marc_session.get("/revision/plan")
    assert marc_plan.status_code == 200, marc_plan.text
    assert marc_plan.json()["scheduled"] >= 1

    sarah_after = sarah_session.get("/revision/plan")
    assert sarah_after.status_code == 200, sarah_after.text
    sarah_scheduled_after = sarah_after.json()["scheduled"]

    assert sarah_scheduled_after == sarah_scheduled_before, (
        "Marc's answer must not change Sarah's scheduled count",
        sarah_scheduled_before,
        sarah_scheduled_after,
    )
