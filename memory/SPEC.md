# Fiches IFSI — SPEC

Plateforme de partage de fiches de révision pour une promo IFSI (école d'infirmiers).
L'utilisateur dépose ses fiches (PDF, images, DOCX, TXT — 10 Mo max), ses camarades de promo
les consultent, prévisualisent, téléchargent et déposent les leurs.

## Accès
- **Code promo partagé** (pas de comptes) : `IFSI2026` — configuré dans `backend/.env` (`ACCESS_CODE`).
- `POST /api/auth/unlock {"code": ...}` pose un cookie httpOnly `promo_access` (30 jours) ;
  toutes les routes fiches vérifient ce cookie (fail-closed). `GET /api/auth/status` répond
  `{unlocked: bool}` ; `POST /api/auth/lock` efface le cookie.
- Frontend : si `/api/auth/status` → `unlocked:false`, écran "Espace promo" (AccessGateModal).
  Si le status fetch échoue (preview statique sans backend) → fail-open vers le shell de l'app.

## Données (Mongo, db "app")
- Collection `sheets` : `id` (uuid4 str), `title`, `domain` (A|B|C|D|E), `author`, `description`,
  `filename` (original), `stored_name` (uuid sur disque — jamais exposé), `mime`, `size`,
  `downloads`, `created_at` (UTC aware).
- Indexes (backend/lib/db.py) : `id` unique, `created_at` desc, `domain`+`created_at` desc.
- Fichiers sur disque : `backend/uploads/` (mkdir au démarrage du router).
- Domaines A–E (IFSI) : libellés + descriptions dans `backend/models/sheet.py` (DOMAINS),
  miroir TS dans `frontend/src/lib/domains.ts` — à synchroniser à la main.

## Endpoints (tous sur api_router, prefix /api)
- `POST /auth/unlock` (401 si code faux), `GET /auth/status`, `POST /auth/lock`
- `GET /sheets?domain=` (cookie requis) — tri created_at desc, limite 500
- `POST /sheets` multipart : file, title, domain, author, description — 201, 413 >10 Mo,
  422 format/domaine/champs invalides (ext: pdf, png, jpg, jpeg, docx, txt)
- `GET /sheets/{id}/file` — inline (preview iframe/img), cookie requis
- `GET /sheets/{id}/download` — attachment + `$inc downloads`, cookie requis
- `DELETE /sheets/{id}` — 204, supprime doc + fichier (cookie requis)
- `/status` (GET/POST) : probe de connectivité du template, inchangée.

## Frontend
- Une seule page `/` (Home) : AppHeader (total + CTA), DomainFilterBar (Tous + A–E avec compteurs),
  recherche instantanée client-side (titre/description/auteur/fichier), grille de SheetCard
  (badge domaine coloré, auteur, date, taille, téléchargements, aperçu PDF/image, suppression avec
  confirmation), UploadSheetDialog (dropzone drag-and-drop, auteur mémorisé en localStorage),
  SheetPreviewDialog (iframe PDF / img), EmptyState, toasts sonner en français.
- `App.tsx` gate sur `["auth-status"]` ; Home requête `["sheets"]` (invalide après upload/delete).
- Données de démo : `backend/seed.py` (idempotent — 4 fiches : PDF bioéthique domaine A,
  txt physio domaine B, png raisonnement clinique domaine C, txt asepsie domaine D).

## Identifiants de test
Voir `memory/test_credentials.md` — le code promo suffit pour tout tester.
