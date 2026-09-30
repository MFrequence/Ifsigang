"""Extraction du texte d'une fiche uploadée, pour la génération de flashcards.

PDF via pypdf, DOCX via lecture du XML (stdlib), TXT en direct. Les images ne sont
pas extractibles — la génération répondra 422 avec un message clair.
"""

import io
import re
import zipfile
from pathlib import Path

from pypdf import PdfReader

MAX_CHARS = 12000  # cap pour la génération de flashcards
READ_CHARS = 200000  # cap pour la lecture sur le site


def extract_text(path: Path, mime: str, limit: int = MAX_CHARS) -> str:
    try:
        if path.suffix.lower() == ".txt" or mime == "text/plain":
            text = path.read_text(encoding="utf-8", errors="replace")
        elif path.suffix.lower() == ".pdf" or mime == "application/pdf":
            reader = PdfReader(io.BytesIO(path.read_bytes()))
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        elif path.suffix.lower() == ".docx":
            text = _docx_text(path.read_bytes())
        else:
            return ""
        return text.strip()[:limit]
    except Exception:  # fichier corrompu / illisible → pas de flashcards, jamais un 500
        return ""


def _docx_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        xml = archive.read("word/document.xml").decode("utf-8", errors="replace")
    xml = re.sub(r"</w:p>", "\n", xml)
    return re.sub(r"<[^>]+>", "", xml)
