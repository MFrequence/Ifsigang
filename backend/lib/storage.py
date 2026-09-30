"""Stockage objet Emergent : les fichiers des fiches survivent aux redéploiements.

Le disque du conteneur est éphémère — `backend/uploads/` est donc traité comme un simple
cache local, et le stockage objet comme la source durable. Mongo reste la source de vérité
des métadonnées (`storage_path`).

L'API ne propose ni suppression ni URL signée : on sert toujours les octets via FastAPI,
et supprimer une fiche revient à oublier sa référence en base.
"""

import logging
import os

import httpx

logger = logging.getLogger(__name__)

# `or` et non default= : la plateforme peut injecter une chaîne vide.
_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = _BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_PREFIX = "fiches-ifsi"

_storage_key: str | None = None


async def init_storage(force: bool = False) -> str:
    """Obtient (et met en cache) la clé de session du stockage. `force` en remint une."""
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{STORAGE_URL}/init",
            json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")},
        )
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
    return _storage_key


def object_path(stored_name: str) -> str:
    """Chemin objet d'une fiche — jamais de slash initial, préfixé par l'app."""
    return f"{APP_PREFIX}/sheets/{stored_name}"


async def put_object(path: str, data: bytes, content_type: str) -> str:
    """Envoie les octets et renvoie le chemin canonique retourné par le stockage."""
    key = await init_storage()
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            content=data,
        )
        if resp.status_code == 404:  # clé de session morte → on en remint une et on réessaie
            key = await init_storage(force=True)
            resp = await client.put(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type},
                content=data,
            )
        resp.raise_for_status()
        return resp.json().get("path", path)


async def get_object(path: str) -> bytes | None:
    """Récupère les octets, ou None si l'objet est introuvable (fiche d'avant la migration)."""
    key = await init_storage()
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key})
        if resp.status_code == 404:
            key = await init_storage(force=True)
            resp = await client.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key})
            if resp.status_code == 404:
                return None
        resp.raise_for_status()
        return resp.content
