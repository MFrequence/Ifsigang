"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, lib)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "sheets": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("created_at", DESCENDING)], name="created_desc"),
        IndexModel([("domain", ASCENDING), ("created_at", DESCENDING)], name="domain_created"),
    ],
    "flashcards": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("sheet_id", ASCENDING), ("order", ASCENDING)], name="sheet_order"),
    ],
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
    ],
    "sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        # Pas d'index TTL : une session expirée est supprimée à sa prochaine utilisation
        # (routers/auth.py) — aucune suppression automatique au démarrage.
        IndexModel([("expires_at", ASCENDING)], name="expires"),
    ],
    "card_results": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("user_id", ASCENDING), ("card_id", ASCENDING)], name="user_card"),
        IndexModel([("sheet_id", ASCENDING)], name="sheet"),
    ],
    "card_schedules": [
        IndexModel([("user_id", ASCENDING), ("card_id", ASCENDING)], name="user_card", unique=True),
        IndexModel([("user_id", ASCENDING), ("due_date", ASCENDING)], name="user_due"),
    ],
    "card_reports": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("card_id", ASCENDING)], name="card"),
        IndexModel([("sheet_id", ASCENDING)], name="sheet"),
    ],
}


async def ensure_indexes() -> None:
    # Ancien index TTL sur les sessions : retiré (plus aucune suppression automatique de
    # documents au démarrage ; une session expirée part à sa prochaine utilisation).
    try:
        await db.sessions.drop_index("ttl")
    except Exception:
        pass

    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
