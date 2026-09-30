# Fiches IFSI — SPEC

Plateforme de partage de fiches de révision pour une promo IFSI (école d'infirmiers).
Dépôt de fiches (PDF, images, DOCX, TXT — 10 Mo max), classement par domaine **et UE**,
consultation/téléchargement par la promo, et **révision par flashcards générées par IA**.

## Accès
- **Code promo partagé** (pas de comptes) : `IFSI2026` — `backend/.env` (`ACCESS_CODE`).
- `POST /api/auth/unlock {"code": ...}` pose un cookie httpOnly `promo_access` (30 jours).
  `require_access` (dépendance FastAPI dans `routers/auth.py`) protège toutes les routes
  fiches + flashcards, en fail-closed. `GET /api/auth/status` → `{unlocked: bool}`.
- Frontend : `App.tsx` gate sur `["auth-status"]` ; si le fetch échoue (preview statique sans
  backend) → fail-open vers le shell, jamais d'écran de panne.

## Données (Mongo, db "app")
- `sheets` : `id` (uuid4 str), `title`, `domain` (A|B|C|D|E), **`unit`** (UE libre, ex. "A1",
  "" si non renseignée), `author`, `description`, `filename`, `stored_name` (uuid disque, jamais
  exposé), `mime`, `size`, `downloads`, `created_at` (UTC aware).
  `SheetOut.from_doc` normalise les datetimes naïfs et coerce `unit: None → ""` (docs antérieurs).
- `flashcards` : `id`, `sheet_id`, `question`, `answer`, `order`.
- Indexes (`backend/lib/db.py`) : sheets → `id` unique, `created_at` desc, `domain`+`created_at` ;
  flashcards → `id` unique, `sheet_id`+`order`.
- Fichiers disque : `backend/uploads/`.
- Domaines A–E : `backend/models/sheet.py` (DOMAINS) ↔ miroir TS `frontend/src/lib/domains.ts`.
  Les **UE sont libres** (pas de liste figée) : les puces de filtre et les suggestions du
  formulaire sont dérivées des valeurs déjà présentes dans les fiches du domaine.

## Endpoints (tous sur api_router, prefix /api)
- `POST /auth/unlock` (401 code faux), `GET /auth/status`, `POST /auth/lock`
- `GET /sheets?domain=` — tri created_at desc, limite 500
- `POST /sheets` multipart : file, title, domain, **unit** (optionnel), author, description
  → 201 ; 413 >10 Mo ; 422 format/domaine/champs (ext: pdf, png, jpg, jpeg, docx, txt)
- `GET /sheets/{id}/file` (inline), `GET /sheets/{id}/download` (attachment + `$inc downloads`)
- `DELETE /sheets/{id}` → 204, supprime doc + fichier + **flashcards en cascade**
- `GET /sheets/{id}/flashcards` → liste triée par `order`
- `POST /sheets/{id}/flashcards/generate` → extrait le texte puis génère ; remplace le paquet
  existant (pas de doublon). 422 si texte < 60 car. (image/PDF scanné), 502 si le LLM ne rend
  rien d'exploitable, 404 fiche inconnue.

## Flashcards / IA
- Extraction texte : `backend/lib/extract.py` — PDF via `pypdf`, DOCX via XML (stdlib), TXT direct,
  tronqué à 12 000 car. Échec de lecture → chaîne vide (jamais un 500).
- Génération : `backend/lib/flashcards.py` — `emergentintegrations.llm.chat.LlmChat`,
  provider `openai`, modèle `gpt-5.4`, clé `EMERGENT_LLM_KEY` (backend/.env).
  Prompt FR exigeant un tableau JSON `[{question, answer}]` ; parsing tolérant (regex sur le
  tableau) ; max 12 cartes.
- Déclenchement : automatique après un upload non-image (appel best-effort côté frontend dans
  `UploadSheetDialog`), et manuel via le bouton « Générer » / « Régénérer » du dialog de révision.

## Frontend
- Page unique `/` (Home) : AppHeader, DomainFilterBar (Tous + A–E avec compteurs **+ rangée de
  puces UE** quand un domaine est sélectionné), recherche instantanée client-side, grille de
  SheetCard (badges UE + domaine, auteur, date, taille, téléchargements, boutons Réviser / Aperçu /
  Télécharger, suppression confirmée).
- `FlashcardsDialog` : paquet question → révélation → auto-évaluation « Je savais » / « À revoir »,
  mélange, régénération, écran de score final, animations `motion`.
- `UploadSheetDialog` : dropzone drag-and-drop, champ UE avec `datalist` de suggestions du domaine,
  auteur mémorisé en localStorage.
- Données de démo : `backend/seed.py` (idempotent, met à jour les fiches `seed-*` sans toucher aux
  fiches réelles) — 4 fiches UE A1/B1/C1/D1 + 4 flashcards prêtes sur la fiche PDF bioéthique.

## Identifiants de test
`memory/test_credentials.md` — le code promo suffit pour tout tester.
