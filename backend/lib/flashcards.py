"""Génération de flashcards via l'Emergent LLM (clé universelle EMERGENT_LLM_KEY)."""

import json
import logging
import os
import re
import uuid

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

PROVIDER, MODEL = "openai", "gpt-5.4"
MAX_CARDS = 12

SYSTEM_MESSAGE = (
    "Tu es tuteur en IFSI (formation infirmière). À partir du contenu d'une fiche de révision, "
    "tu produis des flashcards de révision en français. Réponds UNIQUEMENT par un tableau JSON "
    'valide, sans aucun texte autour, au format exact : [{"question": "...", "answer": "..."}]. '
    "Questions courtes et précises ; réponses de 1 à 2 phrases ; 6 à 12 cartes selon la richesse du contenu."
)


def _parse_cards(raw: str) -> list[dict[str, str]]:
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        return []
    data = json.loads(match.group(0))
    cards: list[dict[str, str]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question", "")).strip()
        answer = str(item.get("answer", "")).strip()
        if question and answer:
            cards.append({"question": question, "answer": answer})
    return cards[:MAX_CARDS]


async def generate_flashcards(text: str) -> list[dict[str, str]]:
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
