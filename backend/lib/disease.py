"""Complétion d'une fiche pathologie par le LLM (une seule fois, puis cache en base).

Même principe que `lib/pharmaco.py` : la génération est payante et lente, donc une fiche
n'est produite qu'une fois et profite ensuite à toute la promo. L'admin peut corriger le
contenu depuis l'espace admin.
"""

import json
import logging
import os
import re

from emergentintegrations.llm.chat import LlmChat, UserMessage

from lib.db import db
from models.disease import DETAIL_FIELDS

logger = logging.getLogger(__name__)

PROVIDER = "openai"
MODEL = "gpt-5.4"

NO_LLM = "no_llm"

SYSTEM_MESSAGE = (
    "Tu es formateur en soins infirmiers dans un IFSI en France. "
    "Tu rédiges une fiche de révision sur une pathologie, au niveau attendu d'un étudiant "
    "infirmier, conforme aux recommandations françaises actuelles (HAS). "
    "Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, avec exactement ces clés : "
    '{"definition": "2 phrases maximum", '
    '"incubation": "incubation si maladie infectieuse, sinon évolution typique, 1 phrase", '
    '"causes": ["causes et facteurs de risque"], "symptoms": ["signes et symptômes"], '
    '"exams": ["examens diagnostiques et de surveillance"], '
    '"treatments": ["traitements médicamenteux (classes) et non médicamenteux"], '
    '"side_effects": ["effets indésirables des traitements cités"], '
    '"nursing_role": ["rôle infirmier et surveillances concrètes"], '
    '"key_points": ["pièges et points clés tombant à l\'examen"]}. '
    "Chaque liste contient 4 à 7 puces courtes en français, sans numérotation. "
    "N'invente aucune posologie précise ; reste sur les classes thérapeutiques."
)


def _parse(content: str) -> dict:
    raw = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("pas d'objet JSON dans la réponse")
    data = json.loads(raw[start : end + 1])
    card: dict = {
        "definition": str(data.get("definition", "")).strip(),
        "incubation": str(data.get("incubation", "")).strip(),
    }
    for field in DETAIL_FIELDS:
        values = data.get(field) or []
        card[field] = [str(v).strip() for v in values if str(v).strip()][:7]
    return card


async def build_details(slug: str, name: str, category_label: str = "") -> dict | str:
    """Complète et enregistre les rubriques détaillées, ou renvoie NO_LLM en cas d'échec."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        return NO_LLM

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"disease-{slug}",
            system_message=SYSTEM_MESSAGE,
        ).with_model(PROVIDER, MODEL)
        prompt = f"Pathologie : {name}."
        if category_label:
            prompt += f" Domaine : {category_label}."
        response = await chat.send_message(UserMessage(text=prompt))
        card = _parse(response if isinstance(response, str) else str(response))
    except Exception as exc:
        logger.warning("build_details(%s): %s", slug, exc)
        return NO_LLM

    if not any(card.get(field) for field in DETAIL_FIELDS):
        return NO_LLM

    existing = await db.diseases.find_one({"slug": slug}, {"_id": 0, "definition": 1})
    update = {field: card[field] for field in DETAIL_FIELDS}
    update["incubation"] = card["incubation"]
    # La définition du catalogue est validée : on ne l'écrase que si elle est vide.
    if card["definition"] and not (existing or {}).get("definition"):
        update["definition"] = card["definition"]
    update["detailed"] = True

    await db.diseases.update_one({"slug": slug}, {"$set": update})
    return update
