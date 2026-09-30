"""Fiche pharmacologique « infirmière » : RCP officiel (BDPM) synthétisé par le LLM.

Le résultat est mis en cache dans Mongo (`drug_cards`) : une fiche n'est générée qu'une fois,
ce qui protège le rate limit de l'API ANSM et évite de repayer l'appel LLM.
"""

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage

from lib.bdpm import fetch_rcp_text
from lib.db import db

logger = logging.getLogger(__name__)

PROVIDER = "openai"
MODEL = "gpt-5.4"

SYSTEM_MESSAGE = (
    "Tu es formateur en pharmacologie dans un IFSI (école d'infirmiers) en France. "
    "À partir d'un extrait du Résumé des Caractéristiques du Produit (RCP) officiel de l'ANSM, "
    "tu produis une fiche de révision fidèle au document, sans rien inventer. "
    "Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, avec exactement ces clés : "
    '{"dci": "substance active principale", "drug_class": "classe pharmacologique", '
    '"indications": ["..."], "dosage": ["posologies usuelles adultes/enfants"], '
    '"side_effects": ["effets indésirables les plus fréquents ou graves"], '
    '"contraindications": ["..."], "nursing_watch": ["points de surveillance infirmière concrets"]}. '
    "Chaque liste contient 3 à 6 puces courtes en français. Si une information est absente du "
    "RCP fourni, mets une puce « Non précisé dans le RCP » plutôt que de deviner."
)

LIST_FIELDS = ("indications", "dosage", "side_effects", "contraindications", "nursing_watch")

NO_RCP = "no_rcp"
NO_LLM = "no_llm"


def _parse(content: str) -> dict:
    raw = content.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("pas d'objet JSON dans la réponse")
    data = json.loads(raw[start : end + 1])
    card = {
        "dci": str(data.get("dci", "")).strip(),
        "drug_class": str(data.get("drug_class", "")).strip(),
    }
    for field in LIST_FIELDS:
        values = data.get(field) or []
        card[field] = [str(v).strip() for v in values if str(v).strip()][:6]
    return card


async def cached_card(cis: str) -> dict | None:
    return await db.drug_cards.find_one({"cis": cis}, {"_id": 0})


async def build_card(cis: str, label: str = "") -> dict | str:
    """Renvoie la fiche (depuis le cache ou fraîchement générée), ou NO_RCP / NO_LLM."""
    existing = await cached_card(cis)
    if existing:
        return existing

    title, rcp = await fetch_rcp_text(cis)
    if len(rcp) < 200:
        return NO_RCP

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        return NO_LLM

    chat = LlmChat(
        api_key=api_key,
        session_id=f"pharmaco-{uuid.uuid4().hex}",
        system_message=SYSTEM_MESSAGE,
    ).with_model(PROVIDER, MODEL)

    try:
        response = await chat.send_message(
            UserMessage(text=f"Médicament : {title or label}\n\nExtrait du RCP :\n{rcp}")
        )
        content = (
            response if isinstance(response, str) else getattr(response, "content", str(response))
        )
        parsed = _parse(content)
    except Exception as exc:  # panne LLM ou JSON illisible : jamais un 500 pour l'étudiant
        logger.error("build_card(%s): %s", cis, exc)
        return NO_LLM

    card = {
        "cis": cis,
        "label": title or label,
        "source": "ANSM — Base de données publique des médicaments (RCP)",
        "generated_at": datetime.now(timezone.utc),
        **parsed,
    }
    await db.drug_cards.update_one({"cis": cis}, {"$set": card}, upsert=True)
    return {k: v for k, v in card.items() if k != "_id"}
