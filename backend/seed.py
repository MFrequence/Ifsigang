"""Seed idempotent : fiches de démonstration (+ unités, + flashcards du PDF).

Run: cd /app/backend && python seed.py
Met à jour les fiches de démo existantes (même stored_name) sans toucher aux autres.
"""

import asyncio
from pathlib import Path

from lib.db import db
from models.flashcard import Flashcard
from models.sheet import Sheet

UPLOADS_DIR = Path(__file__).parent / "uploads"


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


# (title, domain, unit, author, description, filename, content)
DEMO: list[tuple[str, str, str, str, str, str, bytes]] = [
    (
        "Les 4 principes de la bioéthique",
        "A",
        "A1",
        "Marc Dupont",
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
        "Léa Martin",
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
        "Sarah Kaddour",
        "Carte visuelle des 6 étapes du raisonnement infirmier.",
        "domaine-c-raisonnement.png",
        make_png(640, 360, (2, 132, 199)),
    ),
    (
        "Asepsie et antisepsie — protocole",
        "D",
        "D1",
        "Léa Martin",
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
]

# Flashcards prêtes à l'emploi pour la fiche PDF (pas d'appel LLM au seed).
SEED_FLASHCARDS: dict[str, list[tuple[str, str]]] = {
    "domaine-a-bioethique.pdf": [
        (
            "Quel principe de la bioéthique impose de respecter le consentement du patient ?",
            "L'autonomie : respect des choix et du consentement de la personne.",
        ),
        (
            "Que signifie le principe de non-malfaisance ?",
            "Ne pas nuire au patient — éviter de créer du dommage par une action ou une omission.",
        ),
        (
            "Comment s'appelle le principe qui consiste à agir dans l'intérêt du patient ?",
            "La bienfaisance.",
        ),
        (
            "Que recouvre le principe de justice en bioéthique ?",
            "Répartir équitablement les ressources et les soins entre les patients.",
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
    for title, domain, unit, author, description, filename, content in DEMO:
        stored_name = f"seed-{filename}"
        (UPLOADS_DIR / stored_name).write_bytes(content)
        fields = dict(
            title=title,
            domain=domain,
            unit=unit,
            author=author,
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

        cards = SEED_FLASHCARDS.get(filename)
        if cards and await db.flashcards.count_documents({"sheet_id": sheet_id}) == 0:
            await db.flashcards.insert_many(
                [
                    Flashcard(sheet_id=sheet_id, question=q, answer=a, order=i).model_dump()
                    for i, (q, a) in enumerate(cards)
                ]
            )
    print("seed: fiches et flashcards de demonstration a jour")


if __name__ == "__main__":
    asyncio.run(main())
