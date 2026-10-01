"""Rendu HTML d'une fiche DOCX — lecture en ligne avec la mise en forme d'origine.

LibreOffice (conversion PDF fidèle) n'est pas disponible en production : on convertit donc
le DOCX en HTML avec mammoth, qui conserve titres, gras/italique, listes, tableaux et images.

Les images ne sont **pas** inlinées en base64 : un cours illustré pesait 10 Mo de HTML, ce qui
tronquait la fin du document. Elles sont extraites dans un dossier cache et servies une par une
par `GET /api/sheets/{id}/media/{name}` ; le HTML ne pèse alors que quelques dizaines de Ko.
Le cache est régénérable à tout moment depuis le DOCX (source durable).
"""

import logging
import mimetypes
from pathlib import Path

import mammoth

logger = logging.getLogger(__name__)

MAX_HTML = 4_000_000  # garde-fou (images exclues, on en est très loin en pratique)

# Word encode ses styles français ; on mappe les plus courants vers du HTML sémantique.
STYLE_MAP = """
p[style-name='Title'] => h1:fresh
p[style-name='Titre'] => h1:fresh
p[style-name='Subtitle'] => h2:fresh
p[style-name='Sous-titre'] => h2:fresh
p[style-name='Heading 1'] => h2:fresh
p[style-name='Titre 1'] => h2:fresh
p[style-name='Heading 2'] => h3:fresh
p[style-name='Titre 2'] => h3:fresh
p[style-name='Heading 3'] => h4:fresh
p[style-name='Titre 3'] => h4:fresh
p[style-name='Quote'] => blockquote:fresh
p[style-name='Citation'] => blockquote:fresh
r[style-name='Strong'] => strong
r[style-name='Emphasis'] => em
"""


def media_name(sheet_id: str, index: int, content_type: str) -> str:
    extension = mimetypes.guess_extension(content_type or "") or ".png"
    if extension == ".jpe":  # mimetypes renvoie parfois cette variante
        extension = ".jpg"
    return f"{sheet_id}-{index}{extension}"


def docx_to_html(path: Path, sheet_id: str, media_dir: Path) -> str:
    """HTML de la fiche (images extraites dans `media_dir`), ou chaîne vide si illisible."""
    media_dir.mkdir(parents=True, exist_ok=True)
    counter = {"index": 0}

    def store(image) -> dict[str, str]:
        index = counter["index"]
        counter["index"] += 1
        name = media_name(sheet_id, index, getattr(image, "content_type", ""))
        try:
            with image.open() as source:
                (media_dir / name).write_bytes(source.read())
        except Exception as exc:  # une image illisible ne doit pas casser la fiche
            logger.warning("docx image %s: %s", name, exc)
            return {"src": ""}
        return {"src": f"/api/sheets/{sheet_id}/media/{name}", "loading": "lazy"}

    try:
        with path.open("rb") as handle:
            result = mammoth.convert_to_html(
                handle,
                style_map=STYLE_MAP,
                convert_image=mammoth.images.img_element(store),
            )
    except Exception as exc:  # docx corrompu → l'appelant renverra un 422 lisible
        logger.warning("docx_to_html(%s): %s", path.name, exc)
        return ""
    return (result.value or "").strip()[:MAX_HTML]
