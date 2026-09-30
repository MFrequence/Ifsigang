"""Accès à la Base de Données Publique des Médicaments (ANSM) via l'API Médicaments FR.

API publique, sans clé : https://medicaments-api.giygas.dev (routes v1).
Rate limit : 1000 jetons/IP, recharge 3/s → on limite le nombre d'appels et on met en cache
les fiches structurées côté Mongo (lib/pharmaco.py).
"""

import re

import httpx

BASE_URL = "https://medicaments-api.giygas.dev/v1"
TIMEOUT = httpx.Timeout(25.0)

# Rubriques du RCP réellement utiles à une fiche infirmière.
WANTED_SECTIONS = ("4.1", "4.2", "4.3", "4.4", "4.8")
MAX_RCP_CHARS = 9000


def strip_html(raw: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw or "")
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&#39;", "'")
    return re.sub(r"\s+", " ", text).strip()


async def search_medicaments(query: str, limit: int = 15) -> list[dict]:
    """Recherche multi-mots dans la BDPM. Renvoie une liste normalisée (jamais d'exception HTTP)."""
    if len(query.strip()) < 3:
        return []
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            resp = await client.get(f"{BASE_URL}/medicaments", params={"search": query.strip()})
            resp.raise_for_status()
            payload = resp.json()
        except (httpx.HTTPError, ValueError):
            return []

    items = payload if isinstance(payload, list) else payload.get("data", [])
    results: list[dict] = []
    for item in items[:limit]:
        substances = [
            c.get("denominationSubstance", "")
            for c in (item.get("composition") or [])
            if c.get("natureComposant") == "SA"
        ]
        results.append(
            {
                "cis": str(item.get("cis", "")),
                "label": item.get("elementPharmaceutique", ""),
                "form": item.get("formePharmaceutique", "") or "",
                "routes": item.get("voiesAdministration") or [],
                "holder": item.get("titulaire", "") or "",
                "marketed": (item.get("etatComercialisation") or "").startswith("Commercialisée"),
                "substances": [s for s in dict.fromkeys(substances) if s],
            }
        )
    return results


async def fetch_rcp_text(cis: str) -> tuple[str, str]:
    """Renvoie (titre, texte des rubriques 4.x utiles) du RCP. ("", "") si indisponible."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            resp = await client.get(f"{BASE_URL}/medicaments/{cis}/rcp")
            resp.raise_for_status()
            payload = resp.json()
        except (httpx.HTTPError, ValueError):
            return "", ""

    title = payload.get("titre", "") or ""
    chunks: list[str] = []
    for section in payload.get("sections") or []:
        sid = str(section.get("id", ""))
        if sid.startswith(WANTED_SECTIONS):
            body = strip_html(section.get("contenu", ""))
            if body:
                chunks.append(f"{section.get('titre', sid)}\n{body}")
    return title, "\n\n".join(chunks)[:MAX_RCP_CHARS]
