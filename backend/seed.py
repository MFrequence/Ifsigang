"""Seed idempotent : comptes de démo, fiches (UE), flashcards avec distracteurs QCM.

Run: cd /app/backend && python seed.py
Met à jour les fiches de démo existantes (mêmes stored_name) sans toucher aux fiches réelles.
"""

import asyncio
from pathlib import Path

from lib.db import db
from lib.security import hash_password
from models.flashcard import Flashcard
from models.sheet import Sheet
from models.user import User

UPLOADS_DIR = Path(__file__).parent / "uploads"

# (email, nom, mot de passe)
DEMO_USERS = [
    ("lea.martin@ifsi.fr", "Léa Martin", "Promo2026!"),
    ("marc.dupont@ifsi.fr", "Marc Dupont", "Promo2026!"),
    ("sarah.kaddour@ifsi.fr", "Sarah Kaddour", "Promo2026!"),
]


def make_png(width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
    """Minimal valid RGB PNG (8-bit, no interlace) built by hand."""
    import struct
    import zlib

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\x00" + bytes(rgb) * width for _ in range(height))
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def make_pdf(lines: list[str]) -> bytes:
    """Minimal single-page PDF with a correct xref table."""
    parts = ["BT /F1 13 Tf 60 780 Td 20 TL"]
    for line in lines:
        safe = line.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
        parts.append(f"({safe}) Tj T*")
    parts.append("ET")
    stream = "\n".join(parts).encode("latin-1", "replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for index, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{index} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return bytes(out)


# (title, domain, unit, author_email, description, filename, content)
DEMO: list[tuple[str, str, str, str, str, str, bytes]] = [
    (
        "Les 4 principes de la bioéthique",
        "A",
        "A1",
        "marc.dupont@ifsi.fr",
        "Autonomie, bienfaisance, non-malfaisance, justice — avec exemples de situations.",
        "domaine-a-bioethique.pdf",
        make_pdf(
            [
                "Fiche de revision - Domaine A - UE A1 - Sciences humaines, sociales et droit",
                "",
                "Les 4 principes de la bioethique :",
                "1. Autonomie : respect des choix et du consentement de la personne.",
                "2. Bienfaisance : agir dans l'interet du patient.",
                "3. Non-malfaisance : ne pas nuire.",
                "4. Justice : repartir equitablement les ressources et les soins.",
                "",
                "Exemple : un patient refuse une transfusion - l'autonomie prime,",
                "l'equipe documente son choix et verifie sa comprehension.",
            ]
        ),
    ),
    (
        "Physiologie respiratoire — l'essentiel",
        "B",
        "B1",
        "lea.martin@ifsi.fr",
        "Ventilation, hématose, VEMS : ce qu'il faut retenir pour l'examen.",
        "domaine-b-respi.txt",
        (
            "FICHE DE RÉVISION — DOMAINE B (UE B1, sciences biologiques et médicales)\n\n"
            "Physiologie respiratoire :\n"
            "- Ventilation : mouvements inspiratoires (diaphragme) / expiratoires.\n"
            "- Hématose : échange alvéolo-capillaire de l'O2 et du CO2.\n"
            "- VEMS : volume expiratoire maximal en 1 seconde (spirométrie).\n"
            "- Régulation : centre respiratoire bulbaire, chimiorécepteurs CO2.\n"
            "- Fréquence respiratoire normale adulte : 12 à 20 cycles par minute.\n"
        ).encode("utf-8"),
    ),
    (
        "Schéma — les étapes du raisonnement clinique",
        "C",
        "C1",
        "sarah.kaddour@ifsi.fr",
        "Carte visuelle des 6 étapes du raisonnement infirmier.",
        "domaine-c-raisonnement.png",
        make_png(640, 360, (2, 132, 199)),
    ),
    (
        "Asepsie et antisepsie — protocole",
        "D",
        "D1",
        "lea.martin@ifsi.fr",
        "Différences, niveaux de précaution et traçabilité du geste.",
        "domaine-d-asepsie.txt",
        (
            "FICHE DE RÉVISION — DOMAINE D (UE D1, sciences et techniques infirmières : interventions)\n\n"
            "Asepsie vs antisepsie :\n"
            "- Asepsie : absence de micro-organismes (geste aseptique, champs stériles).\n"
            "- Antisepsie : réduction transitoire des germes sur la peau (antiseptique, détersion).\n"
            "- Traçabilité : produit, lot, horaire, opérateur dans le dossier de soins.\n"
            "- Du propre au sale : on ne revient jamais en arrière.\n"
        ).encode("utf-8"),
    ),
    (
        "Posture professionnelle — analyse de situation",
        "E",
        "E1",
        "sarah.kaddour@ifsi.fr",
        "Démarche réflexive complète : les réponses détaillées servent aussi de cas limite d'affichage.",
        "domaine-e-posture.txt",
        (
            "FICHE DE RÉVISION — DOMAINE E (UE E1, intégration des savoirs et posture professionnelle)\n\n"
            "Analyse d'une situation de soin :\n"
            "- Décrire les faits sans interprétation, en distinguant l'observé du ressenti.\n"
            "- Identifier les acteurs, leurs rôles et le cadre légal qui s'applique au soin.\n"
            "- Mobiliser les savoirs biologiques, relationnels et réglementaires pertinents.\n"
            "- Formuler des hypothèses, décider, puis évaluer l'effet de la décision prise.\n"
            "- Réinterroger sa pratique en équipe pour ancrer la démarche réflexive.\n"
        ).encode("utf-8"),
    ),
]

# Flashcards prêtes à l'emploi, avec distracteurs pour le mode QCM (aucun appel LLM au seed).
SEED_FLASHCARDS: dict[str, list[tuple[str, str, list[str]]]] = {
    "domaine-a-bioethique.pdf": [
        (
            "Quel principe de la bioéthique impose de respecter le consentement du patient ?",
            "L'autonomie : respect des choix et du consentement de la personne.",
            [
                "La bienfaisance : agir activement dans l'intérêt du patient.",
                "La justice : répartir équitablement les ressources de soin.",
                "La non-malfaisance : s'abstenir de tout acte nuisible.",
            ],
        ),
        (
            "Que signifie le principe de non-malfaisance ?",
            "Ne pas nuire au patient, par une action comme par une omission.",
            [
                "Obtenir systématiquement le consentement écrit avant tout soin.",
                "Donner la priorité aux patients les plus gravement atteints.",
                "Informer la famille avant d'informer le patient lui-même.",
            ],
        ),
        (
            "Comment s'appelle le principe qui consiste à agir dans l'intérêt du patient ?",
            "La bienfaisance.",
            ["L'autonomie.", "La non-malfaisance.", "La justice distributive."],
        ),
        (
            "Que recouvre le principe de justice en bioéthique ?",
            "Répartir équitablement les ressources et les soins entre les patients.",
            [
                "Respecter en toutes circonstances la volonté exprimée du patient.",
                "Protéger le secret professionnel vis-à-vis des tiers.",
                "Limiter les actes techniques aux seuls soins prescrits.",
            ],
        ),
    ],
    "domaine-d-asepsie.txt": [
        (
            "Quelle est la différence entre asepsie et antisepsie ?",
            "L'asepsie vise l'absence de micro-organismes (geste stérile) ; l'antisepsie réduit "
            "transitoirement les germes sur la peau.",
            [
                "L'asepsie concerne la peau du patient, l'antisepsie le matériel stérile.",
                "L'asepsie s'applique au bloc opératoire, l'antisepsie uniquement en réanimation.",
                "Les deux termes sont équivalents, seul l'usage diffère selon les services.",
            ],
        ),
        (
            "Quels éléments doivent être tracés dans le dossier de soins après un geste antiseptique ?",
            "Le produit utilisé, son lot, l'horaire du geste et l'opérateur.",
            [
                "Uniquement le nom de l'opérateur et la date du soin.",
                "Le diagnostic médical et la prescription associée.",
                "Le nombre de compresses utilisées et le volume de produit.",
            ],
        ),
        (
            "Que signifie la règle « du propre au sale » ?",
            "On progresse toujours de la zone la plus propre vers la plus contaminée, sans jamais revenir en arrière.",
            [
                "On nettoie d'abord les zones souillées pour éliminer le plus gros des germes.",
                "On alterne les zones propres et sales pour économiser les compresses.",
                "On recommence le geste dès qu'une zone propre a été touchée deux fois.",
            ],
        ),
    ],
    # Réponses volontairement très longues : cas limite d'affichage du QCM (la barre
    # d'actions doit rester atteignable, la zone de réponses défile).
    "domaine-e-posture.txt": [
        (
            "Quelles sont les étapes d'une analyse de situation en posture professionnelle infirmière ?",
            "Il faut d'abord décrire les faits observés sans aucune interprétation, en distinguant "
            "systématiquement ce qui a été réellement observé de ce qui relève du ressenti de "
            "l'équipe ; puis identifier l'ensemble des acteurs concernés, leurs rôles respectifs et "
            "le cadre légal applicable au soin envisagé ; ensuite mobiliser les savoirs biologiques, "
            "relationnels et réglementaires pertinents pour la situation ; enfin formuler des "
            "hypothèses, décider, évaluer l'effet de la décision prise et réinterroger sa pratique "
            "en équipe afin d'ancrer durablement la démarche réflexive.",
            [
                "Il faut avant tout appliquer le protocole du service à la lettre et sans le "
                "questionner, puis consigner le geste dans le dossier de soins informatisé, en "
                "laissant au cadre de santé le soin d'analyser après coup la pertinence de la "
                "décision prise, l'analyse réflexive relevant exclusivement de l'encadrement et "
                "non de l'infirmier diplômé qui a réalisé le soin auprès du patient.",
                "Il convient de recueillir d'emblée l'avis du médecin référent puis celui de la "
                "famille du patient, de suivre systématiquement la décision majoritaire ainsi "
                "obtenue, et de ne mobiliser les savoirs théoriques qu'en cas de désaccord "
                "persistant entre les différents acteurs impliqués dans la prise en charge, "
                "l'analyse écrite n'étant requise qu'en cas d'événement indésirable grave.",
                "Il faut commencer par formuler des hypothèses diagnostiques à partir de son "
                "intuition clinique et de son expérience personnelle des situations comparables, "
                "puis rechercher a posteriori dans les faits observés les éléments qui viennent "
                "confirmer ces hypothèses initiales, l'objectif étant de décider le plus "
                "rapidement possible sans se laisser ralentir par le cadre réglementaire.",
            ],
        ),
        (
            "Pourquoi distinguer les faits observés du ressenti dans une analyse de situation ?",
            "Parce que confondre les deux conduit à bâtir le raisonnement clinique sur une "
            "interprétation subjective plutôt que sur des données vérifiables, ce qui fragilise "
            "la décision de soin, rend l'analyse difficilement partageable en équipe et empêche "
            "toute réévaluation objective de l'effet des actions entreprises auprès du patient.",
            [
                "Parce que le ressenti de l'équipe soignante n'a aucune valeur dans la démarche "
                "de soin et doit être systématiquement écarté du dossier du patient comme de "
                "toute transmission orale, seules les données chiffrées issues des appareils de "
                "surveillance pouvant légitimement fonder une décision infirmière.",
                "Parce que la réglementation impose de consigner uniquement les faits objectifs "
                "dans le dossier de soins, le ressenti des professionnels devant faire l'objet "
                "d'un document séparé conservé par l'encadrement et non accessible au patient "
                "ni aux autres membres de l'équipe pluriprofessionnelle.",
                "Parce que le ressenti doit toujours être recueilli en premier afin d'orienter "
                "la recherche des faits pertinents, la subjectivité du soignant constituant le "
                "point de départ méthodologique incontournable de toute analyse de situation "
                "conduite dans le cadre de la formation infirmière.",
            ],
        ),
    ],
}


def mime_for(filename: str) -> str:
    if filename.endswith(".pdf"):
        return "application/pdf"
    if filename.endswith(".png"):
        return "image/png"
    return "text/plain"


async def main() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Comptes de démonstration (idempotents sur l'email).
    users_by_email: dict[str, dict] = {}
    for email, name, password in DEMO_USERS:
        existing = await db.users.find_one({"email": email})
        if existing:
            users_by_email[email] = existing
            continue
        user = User(email=email, name=name, password_hash=hash_password(password))
        await db.users.insert_one(user.model_dump())
        users_by_email[email] = user.model_dump()
    print(f"seed: {len(users_by_email)} comptes de demonstration prets")

    # 2. Fiches de démo, rattachées à leur auteur.
    for title, domain, unit, author_email, description, filename, content in DEMO:
        stored_name = f"seed-{filename}"
        (UPLOADS_DIR / stored_name).write_bytes(content)
        owner = users_by_email[author_email]
        fields = dict(
            title=title,
            domain=domain,
            unit=unit,
            author=owner["name"],
            uploader_id=owner["id"],
            description=description,
            filename=filename,
            mime=mime_for(filename),
            size=len(content),
        )
        existing = await db.sheets.find_one({"stored_name": stored_name})
        if existing:
            await db.sheets.update_one({"stored_name": stored_name}, {"$set": fields})
            sheet_id = existing["id"]
        else:
            sheet = Sheet(stored_name=stored_name, **fields)
            await db.sheets.insert_one(sheet.model_dump())
            sheet_id = sheet.id

        # 3. Flashcards de démo avec distracteurs QCM.
        cards = SEED_FLASHCARDS.get(filename)
        if cards:
            has_distractors = await db.flashcards.count_documents(
                {"sheet_id": sheet_id, "distractors": {"$exists": True, "$ne": []}}
            )
            if has_distractors == 0:
                await db.flashcards.delete_many({"sheet_id": sheet_id})
                await db.flashcards.insert_many(
                    [
                        Flashcard(
                            sheet_id=sheet_id,
                            question=q,
                            answer=a,
                            distractors=d,
                            order=i,
                        ).model_dump()
                        for i, (q, a, d) in enumerate(cards)
                    ]
                )
    print("seed: fiches et flashcards (avec distracteurs QCM) a jour")


if __name__ == "__main__":
    asyncio.run(main())
