"""Générateur d'exercices de calculs de doses et de débits (déterministe, sans IA).

Cinq familles couvrant l'épreuve de calcul de doses en IFSI :
posologie au poids (mg/kg), débit de perfusion (ml/h), gouttes/min, dilution (concentration),
et nombre de comprimés/ampoules. Chaque exercice stocke sa réponse et ses étapes de correction
côté serveur : le client ne reçoit jamais la solution avant de valider.
"""

import random

EXERCISE_TYPES: dict[str, str] = {
    "mg_kg": "Posologie au poids (mg/kg)",
    "ml_h": "Débit de perfusion (ml/h)",
    "gouttes": "Débit en gouttes/min",
    "dilution": "Dilution et concentration",
    "comprimes": "Nombre de comprimés ou d'ampoules",
}


def _round(value: float, digits: int = 2) -> float:
    return round(value + 1e-9, digits)


def _mg_kg() -> dict:
    weight = random.choice([48, 54, 62, 70, 78, 85, 12, 18, 26])
    dose = random.choice([5, 7.5, 10, 15, 20, 30])
    per_day = random.choice([1, 2, 3])
    total = dose * weight
    unit_dose = total / per_day
    return {
        "type": "mg_kg",
        "statement": (
            f"Un patient de {weight} kg doit recevoir {dose} mg/kg/jour d'un traitement, "
            f"réparti en {per_day} prise{'s' if per_day > 1 else ''} par jour. "
            "Quelle dose administrer à chaque prise ?"
        ),
        "unit": "mg",
        "answer": _round(unit_dose),
        "tolerance": 0.05,
        "steps": [
            f"Dose totale sur 24 h = {dose} mg/kg × {weight} kg = {_round(total)} mg",
            f"Nombre de prises = {per_day}",
            f"Dose par prise = {_round(total)} mg ÷ {per_day} = {_round(unit_dose)} mg",
        ],
    }


def _ml_h() -> dict:
    volume = random.choice([250, 500, 1000, 1500])
    hours = random.choice([2, 3, 4, 6, 8, 12, 24])
    rate = volume / hours
    return {
        "type": "ml_h",
        "statement": (
            f"Une perfusion de {volume} ml doit passer en {hours} heures. "
            "Quel débit régler sur la pompe, en ml/h ?"
        ),
        "unit": "ml/h",
        "answer": _round(rate),
        "tolerance": 0.05,
        "steps": [
            f"Débit = volume ÷ durée = {volume} ml ÷ {hours} h",
            f"Débit = {_round(rate)} ml/h",
        ],
    }


def _gouttes() -> dict:
    volume = random.choice([500, 1000, 250])
    hours = random.choice([4, 6, 8, 12, 24])
    drop_factor = 20  # 1 ml = 20 gouttes (perfuseur standard)
    drops = (volume * drop_factor) / (hours * 60)
    return {
        "type": "gouttes",
        "statement": (
            f"Tu dois passer {volume} ml en {hours} heures avec un perfuseur standard "
            f"(1 ml = {drop_factor} gouttes) et sans pompe. "
            "Combien de gouttes par minute règles-tu ?"
        ),
        "unit": "gouttes/min",
        "answer": _round(drops),
        "tolerance": 0.1,
        "steps": [
            f"Volume en gouttes = {volume} ml × {drop_factor} = {volume * drop_factor} gouttes",
            f"Durée en minutes = {hours} h × 60 = {hours * 60} min",
            f"Débit = {volume * drop_factor} ÷ {hours * 60} = {_round(drops)} gouttes/min",
        ],
    }


def _dilution() -> dict:
    amount = random.choice([250, 500, 1000, 2000])  # mg dans l'ampoule
    volume = random.choice([50, 100, 250])  # ml de soluté
    needed = random.choice([100, 150, 200, 400])
    needed = min(needed, amount)
    concentration = amount / volume
    to_inject = needed / concentration
    return {
        "type": "dilution",
        "statement": (
            f"Tu dilues une ampoule de {amount} mg dans {volume} ml de soluté. "
            f"La prescription est de {needed} mg. "
            "Quel volume prélèves-tu dans la seringue ?"
        ),
        "unit": "ml",
        "answer": _round(to_inject),
        "tolerance": 0.05,
        "steps": [
            f"Concentration = {amount} mg ÷ {volume} ml = {_round(concentration)} mg/ml",
            f"Volume à prélever = dose prescrite ÷ concentration = {needed} ÷ {_round(concentration)}",
            f"Volume = {_round(to_inject)} ml",
        ],
    }


def _comprimes() -> dict:
    per_unit = random.choice([25, 50, 100, 250, 500])
    factor = random.choice([0.5, 1, 1.5, 2, 3])
    prescribed = per_unit * factor
    count = prescribed / per_unit
    return {
        "type": "comprimes",
        "statement": (
            f"La prescription est de {_round(prescribed)} mg. "
            f"Tu disposes de comprimés dosés à {per_unit} mg. "
            "Combien de comprimés administres-tu ?"
        ),
        "unit": "comprimé(s)",
        "answer": _round(count),
        "tolerance": 0.01,
        "steps": [
            f"Nombre = dose prescrite ÷ dosage d'un comprimé = {_round(prescribed)} ÷ {per_unit}",
            f"Nombre = {_round(count)} comprimé(s)",
        ],
    }


GENERATORS = {
    "mg_kg": _mg_kg,
    "ml_h": _ml_h,
    "gouttes": _gouttes,
    "dilution": _dilution,
    "comprimes": _comprimes,
}


def generate(kind: str | None = None) -> dict:
    """Génère un exercice ; `kind` vide → tirage au hasard parmi les 5 familles."""
    key = kind if kind in GENERATORS else random.choice(list(GENERATORS))
    exercise = GENERATORS[key]()
    exercise["label"] = EXERCISE_TYPES[exercise["type"]]
    return exercise


def is_correct(expected: float, given: float, tolerance: float) -> bool:
    """Tolérance relative (arrondis admis), avec un plancher absolu pour les petites valeurs."""
    margin = max(abs(expected) * tolerance, 0.01)
    return abs(expected - given) <= margin
