"""Criterion: answering a card feeds progress (/progress/me) and leaderboard (/progress/leaderboard).

Uses the seeded lea.martin@ifsi.fr account. Fetches a real card id from /study/deck
(domain E, which is guaranteed to have flashcards per seed facts), records an answer,
then asserts /progress/me answered count increased and the user appears in the
leaderboard with is_me=True.
"""

import httpx
import pytest

from .conftest import api_url


@pytest.fixture
def lea_session():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": "lea.martin@ifsi.fr", "password": "Promo2026!"})
        assert r.status_code == 200, r.text
        yield c


def test_answer_feeds_progress_and_leaderboard(lea_session):
    c = lea_session

    me = c.get("/auth/me")
    assert me.status_code == 200, me.text
    my_id = me.json()["id"]

    deck = c.get("/study/deck", params={"domain": "E"})
    assert deck.status_code == 200, deck.text
    cards = deck.json()
    assert len(cards) > 0, "Domain E should have flashcards per seed facts"
    card_id = cards[0]["id"]

    before = c.get("/progress/me")
    assert before.status_code == 200, before.text
    answered_before = before.json()["answered"]

    rec = c.post("/progress/answer", json={"card_id": card_id, "correct": True, "mode": "quiz"})
    assert rec.status_code == 201, rec.text
    assert rec.json()["recorded"] is True

    after = c.get("/progress/me")
    assert after.status_code == 200, after.text
    stats = after.json()
    assert stats["answered"] == answered_before + 1, stats
    assert stats["accuracy"] >= 0
    assert "mastered" in stats and "to_review" in stats

    board = c.get("/progress/leaderboard")
    assert board.status_code == 200, board.text
    entries = board.json()
    mine = [e for e in entries if e["user_id"] == my_id]
    assert len(mine) == 1, entries
    assert mine[0]["is_me"] is True
