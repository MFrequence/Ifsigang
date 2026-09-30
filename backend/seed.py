"""Idempotent seed: a few demo fiches so the promo library isn't empty.

Run: cd /app/backend && python seed.py
Not imported by server.py. Gets env + client via lib.db.
"""

import asyncio
from pathlib import Path

from lib.db import db
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


DEMO: list[tuple[str, str, str, str, str, bytes]] = [
    (
        "Les 4 principes de la bioéthique",
        "A",
        "Marc Dupont",
        "Autonomie, bienfaisance, non-malfaisance, justice — avec exemples de situations.",
        "domaine-a-bioethique.pdf",
        make_pdf(
            [
                "Fiche de revision - Domaine A - Sciences humaines, sociales et droit",
                "",
                "Les 4 principes de la bioethique :",
                "1. Autonomie : respect des choix et du consentement de la personne.",
                "2. Bienfaisance : agir dans l'interet du patient.",
                "3. Non-malfaisance : ne pas nuire.",
                "4. Justice : repartir equitablement les ressources et les soins.",
            ]
        ),
    ),
    (
        "Physiologie respiratoire — l'essentiel",
        "B",
        "Léa Martin",
        "Ventilation, hématose, VEMS : ce qu'il faut retenir pour l'examen.",
        "domaine-b-respi.txt",
        (
            "FICHE DE RÉVISION — DOMAINE B (sciences biologiques et médicales)\n\n"
            "Physiologie respiratoire :\n"
            "- Ventilation : mouvements inspiratoires (diaphragme) / expiratoires.\n"
            "- Hématose : échange alvéolo-capillaire de l'O2 et du CO2.\n"
            "- VEMS : volume expiratoire maximal en 1 seconde (spirométrie).\n"
            "- Régulation : centre respiratoire bulbaire, chimiorécepteurs CO2.\n"
        ).encode("utf-8"),
    ),
    (
        "Schéma — les étapes du raisonnement clinique",
        "C",
        "Sarah Kaddour",
        "Carte visuelle des 6 étapes du raisonnement infirmier.",
        "domaine-c-raisonnement.png",
        make_png(640, 360, (2, 132, 199)),
    ),
    (
        "Asepsie et antisepsie — protocole",
        "D",
        "Léa Martin",
        "Différences, niveaux de précaution et traçabilité du geste.",
        "domaine-d-asepsie.txt",
        (
            "FICHE DE RÉVISION — DOMAINE D (sciences et techniques infirmières : interventions)\n\n"
            "Asepsie vs antisepsie :\n"
            "- Asepsie : absence de micro-organismes (geste aseptique, champs stériles).\n"
            "- Antisepsie : réduction transitoire des germes sur la peau (antiseptique, détersion).\n"
            "- Traçabilité : produit, lot, horaire, opérateur dans le dossier de soins.\n"
        ).encode("utf-8"),
    ),
]


def mime_for(filename: str) -> str:
    if filename.endswith(".pdf"):
        return "application/pdf"
    if filename.endswith(".png"):
        return "image/png"
    return "text/plain"


async def main() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    if await db.sheets.count_documents({}) > 0:
        print("seed: des fiches existent deja — rien a faire")
        return
    for title, domain, author, description, filename, content in DEMO:
        stored_name = f"seed-{filename}"
        (UPLOADS_DIR / stored_name).write_bytes(content)
        sheet = Sheet(
            title=title,
            domain=domain,
            author=author,
            description=description,
            filename=filename,
            stored_name=stored_name,
            mime=mime_for(filename),
            size=len(content),
            downloads=3 if filename.endswith(".pdf") else 0,
        )
        await db.sheets.insert_one(sheet.model_dump())
    print(f"seed: {len(DEMO)} fiches de demonstration inserees")


if __name__ == "__main__":
    asyncio.run(main())
