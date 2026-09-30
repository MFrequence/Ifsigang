"""Criterion: server-side J method — a correct answer moves a card to the next J stage
with an increasingly distant due_date (today+1, +3, +7); a wrong answer resets it to J1
(due_date = today+1). Also checks a future-due card drops out of /revision/today.

Uses marc.dupont@ifsi.fr against a Domain E flashcard (guaranteed to have cards per
seed facts). Levels/intervals come straight from lib/revision.py: J_INTERVALS = [0,1,3,7,15,30].
"""

from datetime import date, timedelta

import httpx
import pytest

from .conftest import api_url


@pytest.fixture
def marc_session():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": "marc.dupont@ifsi.fr", "password": "Promo2026!"})
        assert r.status_code == 200, r.text
        yield c


def _offset(due_date: str, today: str) -> int:
    return (date.fromisoformat(due_date) - date.fromisoformat(today)).days


def test_j_method_level_progression_and_reset(marc_session):
    c = marc_session

    plan0 = c.get("/revision/plan")
    assert plan0.status_code == 200, plan0.text
    today = plan0.json()["today"]

    deck = c.get("/study/deck", params={"domain": "E"})
    assert deck.status_code == 200, deck.text
    cards = deck.json()
    assert len(cards) > 0, "Domain E should have flashcards per seed facts"
    card_id = cards[0]["id"]

    # Correct answers climb the ladder: J0->J1(+1)->J3(+3)->J7(+7).
    expected_offsets = [1, 3, 7]
    for expected_offset in expected_offsets:
        r = c.post("/progress/answer", json={"card_id": card_id, "correct": True, "mode": "flash"})
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["recorded"] is True
        assert _offset(body["due_date"], today) == expected_offset, body

    r_levels = c.get("/revision/plan")
    assert r_levels.status_code == 200, r_levels.text

    # A wrong answer resets to J1 regardless of the previous level.
    wrong = c.post("/progress/answer", json={"card_id": card_id, "correct": False, "mode": "flash"})
    assert wrong.status_code == 201, wrong.text
    wrong_body = wrong.json()
    assert wrong_body["level"] == 1, wrong_body
    assert _offset(wrong_body["due_date"], today) == 1, wrong_body

    # Now push it forward again so it is due in the future, and confirm it drops out of today's deck.
    forward = c.post("/progress/answer", json={"card_id": card_id, "correct": True, "mode": "flash"})
    assert forward.status_code == 201, forward.text
    assert _offset(forward.json()["due_date"], today) > 0

    today_deck = c.get("/revision/today", params={"limit": 100})
    assert today_deck.status_code == 200, today_deck.text
    ids_today = [card["id"] for card in today_deck.json()]
    assert card_id not in ids_today, "Card scheduled in the future must not reappear in /revision/today"


def test_revision_today_limit_validation(marc_session):
    c = marc_session
    bad = c.get("/revision/today", params={"limit": 0})
    assert bad.status_code == 422, bad.text
