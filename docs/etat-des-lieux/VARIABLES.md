# Variables d'environnement

🔒 = **secret** : à poser dans le gestionnaire de secrets / les variables secrètes de l'hébergeur, jamais dans le dépôt.
Le gabarit [`.env.example`](../../.env.example) ne contient que les **noms** (un test vérifie qu'aucune valeur secrète n'y figure).

## Liens des locataires

| Variable | Défaut | Rôle |
|---|---|---|
| 🔒 `EDL_TOKEN_SECRET` | — (obligatoire) | Signe les liens. **Distincte** de `JWT_ACCESS_SECRET`. Absente : l'API démarre mais aucun lien ne fonctionne (avertissement au démarrage) |
| `EDL_TOKEN_TTL_DAYS` | `30` | Durée de validité d'un lien |
| `EDL_FRONT_BASE_URL` | `CORS_ORIGIN` | Racine du front pour construire le lien |

## OneDrive

| Variable | Défaut | Rôle |
|---|---|---|
| `ONEDRIVE_CLIENT_ID` | — | ID d'application Azure |
| 🔒 `ONEDRIVE_CLIENT_SECRET` | — | Valeur du secret client Azure |
| `ONEDRIVE_REDIRECT_URI` | — | `https://<api>/onedrive/callback`, identique à Azure |
| `ONEDRIVE_TENANT` | `consumers` | Comptes Microsoft personnels |
| 🔒 `EDL_ENCRYPTION_KEY` | — | 32 octets base64 : chiffre le refresh token en base |

## Conservation, sécurité, PDF

| Variable | Défaut | Rôle |
|---|---|---|
| `EDL_RETENTION_ANNEES` | `3` | Années de conservation après la sortie du locataire |
| `EDL_RETENTION_ACTIVE` | `true` | `false` coupe la purge automatique de 03 h |
| `FORCE_HTTPS` | — | `true` : redirige le HTTP vers HTTPS (308). Avec `TRUST_PROXY` |
| `PUPPETEER_EXECUTABLE_PATH` | auto | Chromium des PDF (`/usr/bin/chromium` dans l'image Docker) |

## Déjà existantes, utilisées par ce module

| Variable | Rôle ici |
|---|---|
| `CORS_ORIGIN` | origine du front : seule autorisée à appeler l'API depuis un navigateur |
| `TRUST_PROXY` | nécessaire à `FORCE_HTTPS` et à la limitation de débit par IP |
| `MAIL_HOST` `MAIL_PORT` `MAIL_USER` 🔒`MAIL_PASSWORD` `MAIL_FROM` `MAIL_BCC` | e-mails du PDF et du lien. `MAIL_BCC` reçoit les PDF, **pas** les liens |
| `JWT_ACCESS_SECRET` 🔒 | session du bailleur (routes d'administration) |
| `DATABASE_URL` / `DB_*` | base PostgreSQL |

## Tests

| Variable | Défaut | Rôle |
|---|---|---|
| `E2E_DB_NAME` | `bailautocomplet_e2e` | base des tests e2e, recréée à chaque lancement (jamais la base de dev) |
