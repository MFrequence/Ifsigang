# Fiches IFSI — SPEC

Plateforme de partage de fiches de révision pour une promo IFSI, avec **comptes étudiants**,
classement par domaine/UE, **révision flashcards + QCM générés par IA**, suivi de progression
personnel et **classement de la promo**.

## Auth (comptes réels)
- `POST /api/auth/signup` — name, email, password (≥6), **invite_code** = `ACCESS_CODE`
  (`IFSI2026`). 403 code invalide, 409 email déjà pris, 422 payload invalide.
- `POST /api/auth/login` — email + password → 401 si mauvais identifiants.
- `GET /api/auth/me` → `UserOut` ; `POST /api/auth/logout` → 204.
- Session : cookie **httpOnly opaque** `session` (30 j) adossé à la collection `sessions`
  (index TTL sur `expires_at`). Aucun token en JSON, aucun token manipulé côté frontend.
- Mots de passe : `passlib` **pbkdf2_sha256** (`backend/lib/security.py`), jamais renvoyés.
- Dépendance partagée `current_user` (`routers/auth.py`) : protège **toutes** les routes
  sheets / flashcards / study / progress. Sans session → 401.
- Frontend : `App.tsx` interroge `["me"]` ; 401 → `pages/Login.tsx` (onglets Connexion /
  Créer un compte). `lib/session.ts` → `beginSession()` après login/signup,
  `endSession()` pour toute déconnexion (vide le cache react-query).

## Données (Mongo, db "app")
- `users` : id, email (unique), name, password_hash, created_at.
- `sessions` : token (unique), user_id, created_at, expires_at (TTL).
- `sheets` : id, title, domain (A–E), `unit` (UE libre, ex. "A1"), author (nom du compte),
  **`uploader_id`**, description, filename, stored_name (uuid disque), mime, size, downloads,
  created_at. `SheetOut.from_doc` normalise les datetimes naïfs et coerce
  `unit`/`uploader_id` `None → ""`.
- `flashcards` : id, sheet_id, question, answer, **`distractors`** (3 mauvaises réponses pour
  le QCM), order.
- `card_results` : id, user_id, card_id, sheet_id, domain, unit, correct, mode
  ("flash"|"quiz"), answered_at.
- Fichiers disque : `backend/uploads/`.
- Domaines A–E : `backend/models/sheet.py` (DOMAINS) ↔ `frontend/src/lib/domains.ts`.
  Les **UE sont libres** : puces de filtre et suggestions dérivées des fiches du domaine.

## Endpoints (tous sur api_router, prefix /api)
- Auth : voir ci-dessus.
- `GET /sheets?domain=` ; `POST /sheets` multipart (file, title, domain, unit?, description?) —
  l'auteur vient du compte connecté, plus de champ nom. 413 >10 Mo, 422 format/domaine.
- `GET /sheets/{id}/file` (inline), `GET /sheets/{id}/download` (+`$inc downloads`)
- `DELETE /sheets/{id}` → 204 + cascade fichier, flashcards **et** card_results
- `GET /sheets/{id}/flashcards` ; `POST /sheets/{id}/flashcards/generate` (remplace le paquet ;
  422 texte < 60 car., 502 LLM inexploitable, 404 fiche inconnue)
- `GET /study/deck?domain=&unit=` → cartes agrégées + contexte fiche + **`due`** (jamais vue ou
  ratée la dernière fois), triées ratées d'abord. 422 domaine inconnu.
- `POST /progress/answer` (card_id, correct, mode) → 201 ; carte inconnue → `{recorded:false}`
- `GET /progress/me` → réponses, réussite %, maîtrisées, à revoir, jours de révision, par domaine
- `GET /progress/leaderboard` → top 50 trié par bonnes réponses puis fiches déposées, `is_me`

## Flashcards / QCM / IA
- Extraction : `lib/extract.py` — PDF (`pypdf`), DOCX (XML stdlib), TXT ; 12 000 car. max ;
  échec de lecture → chaîne vide (jamais un 500).
- Génération : `lib/flashcards.py` — `emergentintegrations` `LlmChat`, provider `openai`,
  modèle `gpt-5.4`, clé `EMERGENT_LLM_KEY`. Le prompt exige
  `[{question, answer, distractors[3]}]` ; parsing tolérant ; max 12 cartes ; les distracteurs
  égaux à la réponse sont filtrés.
- Déclenchement : **tâche de fond FastAPI** lancée par `POST /sheets` (après la réponse) pour
  tout fichier non-image — la génération aboutit même si l'utilisateur ferme son onglet ;
  `lib/flashcards.build_deck_for_sheet()` est le point d'entrée partagé avec la route
  `/generate` (bouton « Générer / Régénérer »). Compter ~15-30 s avant que les cartes
  apparaissent. Une panne LLM n'échoue jamais l'upload (codes `NO_TEXT` / `NO_CARDS`).
- Mode QCM : `StudyRunner` tire 4 propositions (réponse + 3 distracteurs, mélangées). Une carte
  sans distracteurs retombe en mode flashcard avec un bandeau explicatif ; l'onglet QCM est
  désactivé si aucune carte du paquet n'en a.

## Méthode des J (répétition espacée)
- Paliers : **J0, J1, J3, J7, J15, J30** (`lib/revision.py`, `J_INTERVALS`), index = `level`.
- Réponse juste → `level + 1` (borné à J30) ; réponse fausse → retour à **J1** (intervalle
  resserré, conformément à la méthode). Échéance = date du jour + intervalle, **ancrée serveur**
  via `lib/dates.py` (`today_iso`), jamais calculée dans le navigateur.
- `card_schedules` : user_id + card_id (unique), level, due_date (YYYY-MM-DD), reviews, lapses.
  Chaque `POST /progress/answer` met à jour l'échéance et renvoie `{level, due_date}`.
- `GET /revision/today?limit=20` → paquet du jour : cartes **en retard d'abord** (tri par retard
  décroissant), puis échues, puis de nouvelles cartes pour compléter. Chaque carte porte
  `stage` (ex. "J7"), `next_stage`, `is_new`, `overdue_days`.
- `GET /revision/plan` → `due_today`, `new_available`, `scheduled`, `mastered` (palier J30),
  `total_cards`, `upcoming` (charge des 7 prochains jours).
- **Orphelines** : les cartes dont la fiche a été supprimée sont exclues du paquet et du plan ;
  `build_deck_for_sheet` vérifie que la fiche existe encore avant d'insérer (la tâche de fond
  peut finir après une suppression).

## Signalement de cartes erronées
- `POST /flashcards/{card_id}/report` (motif facultatif, 300 car.) → 201, incrémente un compteur
  `reports` porté par la carte (pas de jointure à l'affichage). 404 carte inconnue.
- `GET /sheets/{sheet_id}/reports` → historique des signalements d'une fiche.
- `DELETE /flashcards/{card_id}/report` → 204, remet le compteur à zéro (après correction).
- UI : bouton drapeau dans le moteur de révision → `ReportCardDialog` ; badge « Signalée » dès
  que `reports > 0`.

## Navigation
- `/` → **`pages/Today.tsx`** : « Que veux-tu faire aujourd'hui ? » — 4 tuiles (Réviser
  aujourd'hui avec le compte de cartes dues, Voir les cours, Déposer une fiche, Ma progression)
  + graphique « Mon planning des J » sur 7 jours. C'est l'écran d'arrivée après connexion.
- `/cours` → **`pages/Library.tsx`** : la bibliothèque de fiches (ex-Home), avec un retour
  « Accueil ». Le logo de l'en-tête ramène à `/`.

## Frontend
- `pages/Login.tsx` : connexion / inscription (code d'invitation).
- `pages/Home.tsx` : AppHeader (compteur, « Ma progression », « Déposer une fiche », menu compte
  avec déconnexion), DomainFilterBar (Tous + A–E + rangée UE), recherche client-side,
  bouton **« Réviser la sélection »** (domaine ou UE selon les filtres actifs), grille SheetCard.
  Le domaine est **obligatoire et sans présélection** à l'upload (évite les fiches mal classées).
- `components/StudyRunner.tsx` : moteur partagé flashcards/QCM, auto-évaluation, mélange,
  score final, **badge de palier J** (`showStage`), **bouton de signalement**, hauteur bornée
  avec zone de réponses défilable et barre d'actions collée en bas (cas des réponses longues),
  enregistrement de chaque réponse (`/progress/answer`) + invalidation de `["progress"]`,
  `["leaderboard"]` et `["revision-plan"]`.
- `components/DailyRevisionDialog.tsx` : paquet du jour (méthode des J), `staleTime: Infinity`
  pour ne pas recharger le paquet en pleine session.
- `components/FlashcardsDialog.tsx` (une fiche) et `components/StudySessionDialog.tsx`
  (domaine/UE agrégés, badge « À revoir » sur les cartes dues).
- `components/ProgressDialog.tsx` : onglets « Mon suivi » (4 tuiles + barres par domaine) et
  « Classement promo ».
- Seed : `backend/seed.py` — 3 comptes, 4 fiches (UE A1/B1/C1/D1) rattachées à leurs auteurs,
  7 flashcards avec distracteurs QCM (fiches bioéthique + asepsie).

## Identifiants de test
`memory/test_credentials.md` — comptes de démo + code d'invitation.
