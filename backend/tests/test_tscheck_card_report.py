"""Criterion: anyone can report a flashcard as erroneous; it gets marked (reports counter).

POST /api/flashcards/{card_id}/report -> 201 for a real card, 404 for an unknown id,
401 without a session.
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


def test_report_card_success(marc_session):
    c = marc_session
    deck = c.get("/study/deck", params={"domain": "E"})
    assert deck.status_code == 200, deck.text
    cards = deck.json()
    assert len(cards) > 0
    card_id = cards[0]["id"]

    r = c.post(f"/flashcards/{card_id}/report", json={"reason": "tscheck-report: reponse incorrecte selon moi"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["card_id"] == card_id
    assert "reason" in body


def test_report_card_unknown_id_404(marc_session):
    c = marc_session
    r = c.post("/flashcards/tscheck-report-unknown-card-id/report", json={"reason": "tscheck: carte inconnue"})
    assert r.status_code == 404, r.text


def test_report_card_requires_auth_401():
    with httpx.Client(base_url=api_url(), timeout=30.0) as c:
        r = c.post("/flashcards/any-card-id/report", json={"reason": "tscheck: sans session"})
        assert r.status_code == 401, r.text
