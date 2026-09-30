"""Génération de flashcards + distracteurs QCM via l'Emergent LLM (clé universelle)."""

import json
import logging
import os
import re
import uuid
from pathlib import Path

from emergentintegrations.llm.chat import LlmChat, UserMessage

from lib.db import db
from lib.extract import extract_text
from models.flashcard import Flashcard

logger = logging.getLogger(__name__)

PROVIDER, MODEL = "openai", "gpt-5.4"
MAX_CARDS = 12

SYSTEM_MESSAGE = (
    "Tu es tuteur en IFSI (formation infirmière). À partir du contenu d'une fiche de révision, "
    "tu produis des flashcards de révision en français, utilisables aussi en QCM. "
    "Réponds UNIQUEMENT par un tableau JSON valide, sans texte autour, au format exact : "
    '[{"question": "...", "answer": "...", "distractors": ["...", "...", "..."]}]. '
    "Règles : 6 à 12 cartes selon la richesse du contenu ; questions courtes et précises ; "
    "réponse correcte de 1 à 2 phrases ; exactement 3 distracteurs par carte, plausibles mais "
    "clairement faux, de longueur comparable à la bonne réponse, et jamais synonymes de celle-ci."
)


def _parse_cards(raw: str) -> list[dict]:
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        return []
    data = json.loads(match.group(0))
    cards: list[dict] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question", "")).strip()
        answer = str(item.get("answer", "")).strip()
        if not question or not answer:
            continue
        raw_distractors = item.get("distractors") or []
        distractors = [
            str(d).strip()
            for d in raw_distractors
            if str(d).strip() and str(d).strip().casefold() != answer.casefold()
        ][:3]
        cards.append({"question": question, "answer": answer, "distractors": distractors})
    return cards[:MAX_CARDS]


async def generate_flashcards(text: str) -> list[dict]:
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY manquant")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"flashcards-{uuid.uuid4().hex}",
        system_message=SYSTEM_MESSAGE,
    ).with_model(PROVIDER, MODEL)

    response = await chat.send_message(UserMessage(text=f"Contenu de la fiche :\n\n{text}"))
    content = response if isinstance(response, str) else getattr(response, "content", str(response))
    try:
        return _parse_cards(content)
    except (ValueError, TypeError) as exc:
        logger.error("flashcards: réponse LLM inexploitable: %s", exc)
        return []


# Codes de résultat pour build_deck_for_sheet
NO_TEXT = "no_text"
NO_CARDS = "no_cards"


async def build_deck_for_sheet(sheet_id: str, path: Path, mime: str) -> str | int:
    """Extrait le texte, génère le paquet et REMPLACE l'existant. Renvoie le nombre de
    cartes, ou NO_TEXT / NO_CARDS. Utilisé par la route de génération ET par la tâche de
    fond déclenchée à l'upload (pour ne pas dépendre de l'onglet du navigateur)."""
    text = extract_text(path, mime)
    if len(text) < 60:
        return NO_TEXT
    try:
        cards = await generate_flashcards(text)
    except Exception as exc:  # une panne LLM ne doit jamais casser l'upload
        logger.error("build_deck_for_sheet(%s): %s", sheet_id, exc)
        return NO_CARDS
    if not cards:
        return NO_CARDS
    await db.flashcards.delete_many({"sheet_id": sheet_id})
    await db.flashcards.insert_many(
        [
            Flashcard(
                sheet_id=sheet_id,
                question=c["question"],
                answer=c["answer"],
                distractors=c.get("distractors", []),
                order=i,
            ).model_dump()
            for i, c in enumerate(cards)
        ]
    )
    logger.info("build_deck_for_sheet(%s): %d cartes", sheet_id, len(cards))
    return len(cards)
