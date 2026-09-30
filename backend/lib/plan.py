"""Planning de révisions avant partiel : répartition des fiches sur les jours restants.

Tout est calculé côté serveur (dates ancrées par `lib/dates.py`) et recalculé à chaque
lecture : une fiche déposée après la création du planning rejoint automatiquement le
programme. Seuls le planning (UE, date, fiches cochées) sont stockés.
"""

from datetime import date, timedelta

MAX_DAYS = 60  # au-delà, on planifie seulement les 60 derniers jours avant l'épreuve
FRENCH_DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
FRENCH_MONTHS = [
    "janv.", "févr.", "mars", "avril", "mai", "juin",
    "juil.", "août", "sept.", "oct.", "nov.", "déc.",
]


def parse_iso(value: str) -> date | None:
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def day_label(day: date, today: date) -> str:
    if day == today:
        return "Aujourd'hui"
    if day == today + timedelta(days=1):
        return "Demain"
    return f"{FRENCH_DAYS[day.weekday()]} {day.day} {FRENCH_MONTHS[day.month - 1]}"


def schedule(sheet_ids: list[str], today_iso: str, exam_iso: str) -> list[dict]:
    """Répartit les fiches sur les jours restants (épreuve incluse).

    La dernière journée est toujours une révision générale : elle reprend l'ensemble des
    fiches, en plus de son lot du jour.
    """
    today = parse_iso(today_iso)
    exam = parse_iso(exam_iso)
    if today is None or exam is None or exam < today:
        return []

    span = (exam - today).days + 1
    start = exam - timedelta(days=min(span, MAX_DAYS) - 1)
    days = [start + timedelta(days=i) for i in range((exam - start).days + 1)]

    buckets: list[list[str]] = [[] for _ in days]
    # Les jours d'étude excluent la dernière journée quand il y a de la place pour réviser.
    study_days = len(days) - 1 if len(days) > 2 else len(days)
    for position, sheet_id in enumerate(sheet_ids):
        buckets[position % study_days].append(sheet_id)

    plan: list[dict] = []
    for index, day in enumerate(days):
        is_last = index == len(days) - 1
        plan.append(
            {
                "date": day.isoformat(),
                "label": day_label(day, today),
                "sheet_ids": sheet_ids if (is_last and study_days < len(days)) else buckets[index],
                "is_today": day == today,
                "is_past": day < today,
                "is_review": is_last and study_days < len(days),
            }
        )
    return plan
