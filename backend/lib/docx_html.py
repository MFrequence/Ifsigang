"""Rendu HTML d'une fiche DOCX — lecture en ligne avec la mise en forme d'origine.

LibreOffice (conversion PDF fidèle) n'est pas disponible en production : on convertit donc
le DOCX en HTML avec mammoth, qui conserve titres, gras/italique, listes, tableaux et images
(images inlinées en base64, donc aucun fichier supplémentaire à servir).

Les couleurs de texte exactes de Word ne sont pas reprises par mammoth : la feuille de style
du site prend le relais pour rester lisible en thème clair comme sombre.
"""

import logging
from pathlib import Path

import mammoth

logger = logging.getLogger(__name__)

MAX_HTML = 2_000_000  # garde-fou : un DOCX très imagé peut gonfler en base64

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


def docx_to_html(path: Path) -> str:
    """HTML de la fiche, ou chaîne vide si le document est illisible."""
    try:
        with path.open("rb") as handle:
            result = mammoth.convert_to_html(handle, style_map=STYLE_MAP)
    except Exception as exc:  # docx corrompu → l'appelant renverra un 422 lisible
        logger.warning("docx_to_html(%s): %s", path.name, exc)
        return ""
    return (result.value or "").strip()[:MAX_HTML]
