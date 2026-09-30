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
  **Barre de tri** au-dessus de la grille (`sheet-sort-bar`, client-side) : « Plus récentes »
  (défaut), « Plus téléchargées », « Par auteur (A-Z) » — départage toujours par date récente ;
  affiche aussi le nombre de fiches filtrées (`sheet-result-count`).
  **Favoris** : étoile sur chaque SheetCard (`sheet-favorite-button-{id}`) + filtre « Favoris (n) »
  (`sheet-favorites-filter-button`) dans la barre de tri. Stockés par étudiant dans
  `sheet_favorites` (`{user_id, sheet_id}`), API `GET /api/sheets/favorites` (liste d'ids),
  `POST|DELETE /api/sheets/{id}/favorite` (POST idempotent) ; purgés avec la fiche.
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

## Série de jours (streak) — ajout
- Règle : un jour compte comme validé quand **toutes** les révisions dues ce jour-là sont
  terminées. La validation est écrite à la volée dans `revision_days` ({user_id, date})
  par `lib/streak.mark_day_if_cleared()`, appelée après chaque `POST /progress/answer`
  (la réponse renvoie `day_completed`). Non recalculable a posteriori (les échéances bougent).
- `GET /api/revision/streak` → `Streak` : current, best, completed_today, remaining_today,
  total_days, days[7] ({date, completed, is_today}) — dates ancrées serveur (lib/dates.py).
- Frontend : `components/StreakCard.tsx` — carte « encre chaude » (flamme animée `animate-flame`,
  compteur, 7 pastilles de jours, record, bouton « Entretenir ma série ») placée **à droite du
  titre « Que veux-tu faire aujourd'hui ? »** dans le hero de `pages/Today.tsx`
  (grid lg:[1.15fr_minmax(0,380px)], empilée en mobile). Query `["revision-streak"]`, invalidée
  par `StudyRunner` après chaque réponse. (Une variante compacte en barre du haut a été essayée
  puis retirée à la demande de l'utilisateur.)
- En-tête compacté pour tenir sans débordement de 360 px à 1440 px : sous-titre de marque et
  libellés Jour/Nuit visibles seulement en très large, compteur de fiches en 2xl, bouton
  progression réduit à une icône (masqué sous md), libellé du bouton d'upload dès xl.
  L'état du thème vit dans `AppHeader` (ThemeToggle est contrôlé) et une entrée de menu
  `menu-theme-item` bascule le thème au téléphone.

## Refonte design (dernière itération)
- `index.css` : keyframes `flame-pulse`, `subtle-float`, `rise-in` + utilitaires
  `.animate-flame-pulse/.animate-float/.animate-rise`, `.mesh-bg`, `.glass-card`,
  et `prefers-reduced-motion` désactivant les animations.
- Today : hero typographique, carte streak sombre, tuiles bento en verre dépoli avec
  dégradés d'icônes, graphe des J en dégradé. Library : fond mesh + barre de filtres glass.
  Login : split layout (panneau visuel promo + image Unsplash à gauche, formulaire à droite).

## Espace admin — suppression de comptes
- `ADMIN_PASSWORD` (backend/.env) déverrouille l'espace : `POST /api/admin/unlock` pose
  `is_admin: true` sur le document `sessions` de la session en cours (`POST /admin/lock` annule,
  `GET /admin/status` renvoie {is_admin, configured}). Dépendance `admin_guard`.
- `GET /api/admin/users` → AdminUser[] (nom, email, nb de fiches, nb de réponses, is_me).
- `DELETE /api/admin/users/{id}` → suppression TOTALE : fichiers disque + sheets de l'uploader,
  flashcards/card_results/card_schedules/card_reports liés, progression et revision_days du
  compte, ses sessions, puis le user. 400 si c'est le compte connecté, 404 si inconnu.
- Frontend : `components/AdminDialog.tsx` monté dans `AppHeader` (menu avatar → Espace admin),
  confirmation en deux temps avant suppression.

## Page admin dédiée (/admin) — remplace le pop-up
- Route `/admin` (`pages/Admin.tsx`, montée dans App.tsx), accès par le menu avatar
  (`menu-admin-item` → navigate("/admin")). `AdminDialog` supprimé ; `AppHeader` accepte
  désormais `onUploadClick`/`onProgressClick` optionnels (masqués sur la page admin).
- Onglet **Comptes** : liste + suppression totale (`DELETE /api/admin/users/{id}`).
- Onglet **Fiches** : toutes les fiches de la promo + suppression via `DELETE /api/sheets/{id}`
  (cascade fichier disque, flashcards, résultats, échéances, signalements).
- Base remise à zéro avant publication : seul compte = `brianpro1@outlook.fr`, 0 fiche.

## Refonte design « Clinical Neo-Editorial » + thème Jour/Nuit
- Thème : `frontend/src/lib/theme.ts` (localStorage `ifsi-theme-preference`, **sombre par défaut**,
  `class="dark"` sur <html> dans index.html) + `components/ThemeToggle.tsx` (capsule segmentée
  Jour/Nuit, `theme-toggle-button`, `theme-toggle-light`, `theme-toggle-dark`) dans AppHeader.
- Tous les écrans utilisent désormais les tokens sémantiques (bg-background/card, text-foreground,
  text-muted-foreground, border-border, primary émeraude) — plus de couleurs slate/sky en dur,
  sauf la carte de série (encre chaude ambre volontairement sombre dans les deux thèmes).
- Polices : Lora Variable (titres, serif éditorial), Instrument Sans Variable (texte),
  JetBrains Mono Variable (métriques/labels). Paquets @fontsource-variable installés.
- index.css : utilitaires `.clinical-grid`, `.clinical-rule`, `.glow-primary`, animations
  `animate-flame`, `animate-ecg`, `animate-rise`, `animate-float` + prefers-reduced-motion.
- Domaines A–E : classes badge/chip déclinées clair+sombre dans `lib/domains.ts`.
- Base repartie à zéro après vérification (0 fiche, 0 flashcard, 1 compte : brianpro1@outlook.fr).

## Sécurité & modération (avant publication)
- **Mot de passe oublié (réinitialisation admin)** : `POST /api/admin/users/{id}/reset-password`
  → génère `IFSI-XXXXXX-NN`, pose `must_change_password: true`, **révoque toutes les sessions**
  du compte et renvoie le mot de passe temporaire (affiché + copiable dans /admin).
  `POST /api/auth/change-password` (current_password + new_password ≥ 6) → 403 si mot de passe
  actuel faux, 422 si identique. `UserOut.must_change_password` force l'ouverture du dialogue
  `ChangePasswordDialog` (non fermable tant que le mot de passe n'est pas changé).
- **Signalement de fiche** : `POST /api/sheets/{id}/report` {reason} → collection `sheet_reports`.
  Admin : `GET /api/admin/sheet-reports`, `DELETE /api/admin/sheet-reports/{id}` (marquer traité),
  onglet « Signalements » avec compteur. Supprimer une fiche purge ses signalements.
- **Droits de suppression** : `DELETE /api/sheets/{id}` n'autorise que l'auteur
  (`uploader_id == user.id`) **ou** une session admin déverrouillée → 403 sinon. Dans la
  bibliothèque, la corbeille n'apparaît que sur ses propres fiches ; sur celles des autres, c'est
  un bouton « signaler ».

## Lexique infirmier (/lexique)
- Collection `lexicon`. Base fournie avec la plateforme : `backend/lib/lexicon_seed.py`
  (~108 entrées, seed **idempotent** lancé en tâche de fond au démarrage de server.py, clé
  term+category, ne touche jamais aux ajouts de la promo).
- Catégories de lieu de stage : general, medecine, chirurgie, urgences, psychiatrie, ehpad,
  pediatrie (`LEXICON_CATEGORIES` dans models/reference.py ↔ `frontend/src/lib/lexicon.ts`).
- API : `GET /api/lexicon?category=`, `POST /api/lexicon` (409 si doublon), `DELETE /api/lexicon/{id}`
  (auteur ou admin). Les entrées de la base IFSI ne sont pas supprimables par les étudiants
  (`editable: false`).
- Frontend : `pages/Lexique.tsx` (pastilles de catégorie avec compteurs, recherche, ajout en dialogue).

## Pharmacologie (/pharmacologie)
- Source officielle : **API Médicaments FR / BDPM (ANSM)**, `https://medicaments-api.giygas.dev/v1`,
  publique et sans clé (`backend/lib/bdpm.py`, httpx) : recherche + RCP (on ne garde que les
  rubriques 4.1/4.2/4.3/4.4/4.8, HTML nettoyé, tronqué à 9000 caractères).
- `backend/lib/pharmaco.py` : le RCP est synthétisé en fiche IDE (dci, classe, indications,
  posologie, effets indésirables, contre-indications, surveillance IDE) par le LLM
  (emergentintegrations, openai/gpt-5.4, EMERGENT_LLM_KEY) puis **mis en cache dans
  `drug_cards`** → 1 seul appel LLM par médicament (13 s la 1re fois, ~0,2 s ensuite).
- API : `GET /api/pharmaco/search?q=` (min 3 car., 422 sinon), `GET /api/pharmaco/cards`
  (fiches déjà générées), `GET /api/pharmaco/cards/{cis}` (404 si pas de RCP exploitable,
  502 si synthèse indisponible).
- Disclaimer obligatoire affiché sur la page (`pharmaco-disclaimer`) : synthèse pédagogique,
  ne remplace ni le RCP, ni la prescription, ni le protocole du service.
- Navigation : liens Cours / Lexique / Pharmaco dans AppHeader + tuiles sur la page Aujourd'hui.

### Favoris pharmaco
- Collection `drug_favorites` ({id, user_id, cis, label, dci, drug_class, created_at}), propre à
  chaque étudiant. `GET /api/pharmaco/favorites`, `POST /api/pharmaco/favorites/{cis}`
  (idempotent via `$setOnInsert`, génère la fiche si besoin, 404 si pas de RCP exploitable),
  `DELETE /api/pharmaco/favorites/{cis}`. Purgés à la suppression du compte (routers/admin.py).
- Frontend : bouton « Épingler à mon stage » dans l'en-tête de fiche + section
  « Les médicaments de mon stage » en haut de /pharmacologie (query `["drug-favorites"]`).

## Schémas d'anatomie à compléter (/schemas)
- 6 schémas générés pour la plateforme (repères numérotés, AUCUN nom visible) définis dans
  `backend/lib/anatomy.py` : cœur, appareil respiratoire, rein, appareil digestif, squelette,
  neurone. Le mapping numéro → étiquette **reste serveur** : `GET /api/anatomy/{slug}` renvoie
  les numéros + les étiquettes **mélangées**, la correction se fait dans
  `POST /api/anatomy/{slug}/attempt` (comparaison insensible à la casse et aux accents) qui
  renvoie score, repères justes et la solution, puis enregistre la tentative
  (`anatomy_attempts`). `GET /api/anatomy` liste les schémas avec le meilleur score de l'étudiant.
- Frontend `pages/Anatomie.tsx` : glisser-déposer maison en **pointer events** (souris + tactile,
  le DnD HTML5 natif ne marche pas sur mobile) avec fantôme suivant le curseur ; un simple tap
  sélectionne l'étiquette puis le repère. Correction en vert/rouge avec la bonne réponse affichée.
- Progression : section « Schémas d'anatomie » dans `ProgressDialog` (hors du bloc flashcards,
  donc visible même sans carte révisée). Tentatives purgées à la suppression d'un compte.
- `AppHeader` : `onProgressClick` optionnel — sans handler, l'en-tête monte son propre
  ProgressDialog, donc « Ma progression » est accessible depuis toutes les pages.

## Efficacité de révision — 4 ajouts

### Auto-évaluation en 3 niveaux (méthode des J)
`AnswerRequest.quality` = "easy" | "medium" | "hard" (optionnel, 422 si autre valeur).
`lib/revision.next_level(level, correct, quality)` : easy → palier suivant, **medium → J3
systématiquement** (niveau 2), hard/faux → J1. Les QCM restent en juste/faux (quality absent).
`POST /api/progress/answer` renvoie aussi `stage` ("J7"…). Frontend : 3 boutons
Facile / Moyen / À revoir dans `StudyRunner` (`study-known-button`, `study-medium-button`,
`study-review-button`).

### Recherche globale (Ctrl/Cmd + K)
`GET /api/search?q=` (min 2 car., 422 sinon) → {sheets, lexicon, drugs} (8 max par section,
regex insensible à la casse sur titre/description/UE/auteur, terme/définition, label/DCI/classe).
Frontend : `components/GlobalSearchDialog.tsx` monté dans `AppHeader` (bouton loupe
`open-global-search-button` + raccourci clavier), navigation vers /cours, /lexique, /pharmacologie.

### Calculs de doses (/calculs)
`backend/lib/calc.py` : 5 familles générées sans IA (mg_kg, ml_h, gouttes, dilution, comprimes),
chacune avec réponse, tolérance et étapes de correction. `GET /api/calc/types`,
`GET /api/calc/exercise?type=` (l'exercice est stocké dans `calc_exercises` — la réponse ne part
jamais avant la validation), `POST /api/calc/answer` (404 si exercice inconnu) → correct, réponse
attendue, étapes, série en cours ; `GET /api/calc/stats`. Frontend `pages/Calculs.tsx`.

### Examen blanc (/examen)
`POST /api/exam/start?domain=&unit=` → jusqu'à 20 QCM tirés au hasard (flashcards ayant au moins
un distracteur), choix mélangés, solutions stockées dans `exams` côté serveur ; 404 si aucun QCM
dans le périmètre, 422 sur domaine invalide. `POST /api/exam/{id}/submit` → score, **note sur 20**,
durée et correction question par question ; `GET /api/exam/history`. Chronomètre côté client.
Frontend `pages/Examen.tsx`. Données purgées à la suppression d'un compte (routers/admin.py).

Navigation : liens Cours / Lexique / Schémas / Calculs / Examen / Pharmaco dans l'en-tête +
tuiles « Calculs de doses » et « Examen blanc » sur la page Aujourd'hui.
Base remise à zéro après vérification (0 fiche, 1 compte, lexique de 108 entrées conservé).

### Réviser mes erreurs
`GET /api/revision/mistakes?limit=` : pour chaque carte, on ne garde que la **dernière** réponse
(`card_results` trié par answered_at desc) et on renvoie celles dont la dernière tentative était
fausse, toutes fiches confondues, du ratage le plus récent au plus ancien (cartes orphelines
exclues). Une carte ratée puis réussie disparaît automatiquement de la liste.
Frontend : `components/MistakesDialog.tsx` (réutilise StudyRunner) + tuile `action-mistakes` sur
la page Aujourd'hui avec le compteur de cartes ratées ; query `["revision-mistakes"]`.

### Calculs chronométrés (mode chrono)
10 calculs en 5 minutes, piloté côté client dans `pages/Calculs.tsx` (constantes SPRINT_SIZE=10,
SPRINT_SECONDS=300). **Piège corrigé** : le `setInterval` du décompte ne doit dépendre que de
`sprintRunning` (booléen) et appeler la mutation via une ref — sinon l'identité de l'objet
mutation recrée l'intervalle à chaque render et le chrono reste figé.
Résultat enregistré par `POST /api/calc/sprint` {score, total, seconds} (422 si score > total ou
hors bornes) ; historique et meilleur score via `GET /api/calc/sprints`. Purge à la suppression
d'un compte.


## Stockage des fichiers de fiches (durable)

Le disque du conteneur est **éphémère** : un redéploiement repart d'un disque vide. Les fichiers
uploadés vivent donc dans le **stockage objet Emergent** (`backend/lib/storage.py`, clé
`EMERGENT_LLM_KEY`, hôte `INTEGRATION_PROXY_URL`, préfixe `fiches-ifsi/sheets/<stored_name>`).

- `backend/uploads/` n'est qu'un **cache local** ; Mongo garde `storage_path` (source de vérité).
- `routers/sheets.py::ensure_local_file(doc)` sert les octets : disque si présent, sinon
  re-téléchargement depuis le stockage objet (utilisé par `/file`, `/download` et la
  régénération de flashcards).
- Upload : copie durable obligatoire (échec → 502, rien n'est enregistré en base).
- `migrate_local_files_to_storage()` tourne au démarrage (lifespan) : pousse les fiches
  sans `storage_path` encore présentes sur disque. Idempotent.
- L'API de stockage n'a **ni suppression ni URL signée** : supprimer une fiche efface sa
  référence en base (l'objet reste, inaccessible), et tout passe par le backend.


## Lecture des fiches sur le site (sans téléchargement)

- `GET /api/sheets/{id}/text` → `SheetText {text, truncated}` : texte extrait par
  `lib/extract.py::extract_text(..., limit=READ_CHARS=200000)` (TXT, DOCX, PDF).
  422 sur une image ou un document scanné/illisible, 404 si le fichier est introuvable.
- `GET /api/sheets/{id}/html` → `SheetHtml {html}` : **DOCX rendu en HTML** via
  `lib/docx_html.py` (mammoth + style map FR/EN) — titres, gras, listes, tableaux et images
  du document (base64 inline) conservés. 422 hors .docx ou si la mise en forme est illisible.
  LibreOffice (vraie conversion PDF) est impossible : aucun paquet système en production.
- `components/SheetPreviewDialog.tsx` : PDF en `<iframe>`, images en `<img>`,
  **DOCX en HTML** (`sheet-html-content`, styles Tailwind sur le HTML injecté),
  **TXT en texte** (`sheet-text-content`) ; un DOCX dont le HTML échoue retombe sur le texte.
  États partagés : `sheet-reader-loading`, `sheet-reader-error`.
- `lib/format.ts::isTextReadable` / `isPreviewable` : tous les formats acceptés sont
  maintenant lisibles en ligne → le bouton de la carte s'appelle « Lire ».
