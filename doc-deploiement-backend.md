# Documentation Déploiement Backend - BailAutoComplete

## Stack technique

- **Framework** : NestJS 11
- **Node** : 20
- **Base de données** : PostgreSQL
- **ORM** : TypeORM 0.3 (`synchronize` désactivé, schéma piloté par les migrations)
- **Migrations** : migrations TypeORM (`src/database/migrations`)
- **Build** : npm / `nest build`
- **Conversion PDF** : LibreOffice Writer, dans l'image (`libreoffice-convert`)
- **Hébergement** : Koyeb (gratuit, ne s'éteint pas)
- **Base de données hébergée** : Render PostgreSQL

> Le backend était auparavant en Spring Boot 3.3 / Java 17 / Maven / Liquibase.
> Le contrat HTTP est inchangé : mêmes routes, mêmes charges utiles JSON.

---

## Architecture de déploiement

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Frontend     │ ──── │    Backend      │ ──── │   PostgreSQL    │
│    (Vercel)     │      │    (Koyeb)      │      │    (Render)     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## Variables d'environnement

| Variable | Obligatoire | Défaut | Rôle |
|----------|-------------|--------|------|
| `DATABASE_URL` | en production | — | URL de connexion, forme `postgres://user:pass@hote:5432/base` **ou** `jdbc:postgresql://hote:5432/base?user=…&password=…` |
| `DB_USERNAME` / `DB_PASSWORD` | si absents de l'URL | `postgres` / `root` | Identifiants |
| `DB_HOST` / `DB_PORT` / `DB_NAME` | en local | `localhost` / `5432` / `bailAutoComplete` | Connexion locale quand `DATABASE_URL` n'est pas défini |
| `DB_SSL` | non | déduit de `sslmode=require` | Force le SSL (requis par Render) |
| `DB_MIGRATIONS_RUN` | non | `true` | Applique les migrations au démarrage, comme le faisait Liquibase |
| `DB_LOGGING` | non | `false` | Trace le SQL |
| `CORS_ORIGIN` | oui | `http://localhost:4200` | Origine autorisée |
| `PORT` | non | `8080` | Port d'écoute |
| `INSEE_BDM_BASE_URL` | non | service SDMX public | Endpoint INSEE |
| `INSEE_IRL_IDBANK` | non | `001515333` | Série IRL |
| `INSEE_IRL_CACHE_TTL_HOURS` | non | `6` | Durée du cache IRL |
| `JWT_ACCESS_SECRET` | **oui** | — | Signature de l'access token. **L'API refuse de démarrer sans.** |
| `JWT_REFRESH_SECRET` | **oui** | — | Signature du refresh token. Valeur **différente** de la précédente. |
| `JWT_ACCESS_TTL` | non | `900` | Durée de vie de l'access token, en secondes |
| `JWT_REFRESH_TTL` | non | `604800` | Durée de vie du refresh token, en secondes |
| `COOKIE_SAMESITE` | **si domaines distincts** | `strict` | `none` obligatoire quand le front n'est pas sur le même site que l'API |
| `COOKIE_SECURE` | non | `true` si `NODE_ENV=production` | Réserve les cookies à HTTPS |
| `COOKIE_DOMAIN` | non | — | À ne poser que pour partager les cookies entre sous-domaines |

Un gabarit complet est fourni dans `.env.example`.

### Authentification : les deux pièges du premier déploiement

**1. Les secrets JWT sont obligatoires.** Sans eux, le conteneur s'arrête au
démarrage sur :

```
ERROR [ExceptionHandler] Error: JWT_ACCESS_SECRET est absent de l'environnement
```

C'est délibéré : signer les jetons avec une valeur par défaut reviendrait à
laisser n'importe qui forger une session. Générer deux valeurs **distinctes** :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**2. Le mot de passe vit en base, pas dans l'environnement.** Il n'est pas
déployé avec le code et aucune route HTTP ne permet de le poser. Il faut le semer
sur la base **de production**, depuis un poste local pointé sur elle :

```bash
DATABASE_URL='postgres://user:pass@hote:5432/base' npm run auth:seed
```

Un mot de passe semé en local ne vaut que pour la base locale : `/auth/login`
répondra 401 en production tant que l'opération n'a pas été faite là-bas.

**3. Cookies cross-domaine.** Le front et l'API n'étant pas sur le même domaine,
il faut `COOKIE_SAMESITE=none` (avec HTTPS, donc `COOKIE_SECURE=true`, déjà
implicite en production) et `CORS_ORIGIN` réglé sur l'URL exacte du front. Sinon
le navigateur ignore les cookies **silencieusement**, sans message d'erreur.

Le détail complet est dans `doc-authentification.md`.

---

## Base de données

### Mise à niveau d'une base existante (production, ou base locale déjà remplie)

Le schéma de production a été construit par Liquibase. Les migrations TypeORM
**rejouent le même historique** : il ne faut donc pas les exécuter sur cette
base, mais les marquer comme déjà appliquées.

```bash
DB_MIGRATIONS_RUN=false npm run migration:baseline
```

Le script refuse de s'exécuter si la table `appartement` n'existe pas, pour
éviter de « baseliner » une base vierge par erreur.

> **À faire une seule fois, avant le premier déploiement de la version NestJS.**
> Sans cela, le démarrage échouera sur un `CREATE TABLE "bailleur"` alors que la
> table existe déjà.

### Création d'une base de zéro

```bash
createdb bailAutoComplete
npm run migration:run
```

Les migrations recréent le schéma **et** les données de référence (bailleurs,
appartements, chambres, caractéristiques) à l'identique de la production.

### Correspondance avec les anciens changelogs Liquibase

Chaque migration porte en en-tête le changelog dont elle est issue. Deux écarts
volontaires :

- **`changelog-29`** n'a pas d'équivalent : il n'était pas référencé dans
  `db.changelog-master.xml`, n'a donc jamais été appliqué, et ciblait de toute
  façon une colonne `adress` inexistante sur la table `caracteristique`.
- **`1700000031000-AddValIrlAndTIrlToAppartement`** n'a pas de changelog
  d'origine : les colonnes `appartement.val_irl` et `appartement.t_irl` avaient
  été créées silencieusement par Hibernate (`ddl-auto=update`). Sans cette
  migration, une base recréée de zéro serait incomplète.

### Commandes

```bash
npm run migration:show      # état des migrations
npm run migration:run       # applique les migrations en attente
npm run migration:revert    # annule la dernière migration
npm run migration:baseline  # marque tout comme appliqué, sans exécuter
```

---

## Développement local

```bash
npm install
cp .env.example .env        # ajuster les identifiants Postgres
npm run start:dev           # http://localhost:8080
npm test                    # tests unitaires
```

Le front (`bailAutoComplete-Front`) proxifie `/api` vers `http://localhost:8080`
via `proxy.conf.json` : rien à changer côté front.

---

## Intégration API INSEE — récupération automatique de l'IRL

L'IRL (Indice de Référence des Loyers) est récupéré automatiquement depuis le service web SDMX public de la **BDM (Banque de Données Macroéconomiques)** de l'INSEE. **Aucune clé / token n'est nécessaire** : cet endpoint est ouvert.

### Endpoint INSEE utilisé

```
GET https://www.bdm.insee.fr/series/sdmx/data/SERIES_BDM/{idbank}?startPeriod={annee}
```

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `idbank` | `001515333` | Série de l'IRL trimestriel (base 100 au T4 1998, France entière) |
| `startPeriod` | ex. `2024` | Borne basse pour alléger la réponse |

Exemple :
```bash
curl "https://www.bdm.insee.fr/series/sdmx/data/SERIES_BDM/001515333?lastNObservations=1"
```

Réponse (SDMX XML) — on lit l'observation la plus récente :
```xml
<Obs TIME_PERIOD="2026-Q1" OBS_VALUE="146.6" .../>
```
→ injecté comme `valIrl = "146.6"` et `tIrl = "T1 2026"`.

### Comportement côté API BailAutoComplete

Sur **`GET /appartement/{id}`** et **`GET /appartement`** (liste) : tant que l'IRL n'a pas été saisi à la main, les champs `valIrl` et `tIrl` sont remplis avec la dernière valeur publiée par l'INSEE, puis persistés. En cas d'indisponibilité de l'INSEE, la valeur en base est conservée (pas d'erreur). Sur la liste, l'IRL n'est récupéré qu'une seule fois (mise en cache) pour l'ensemble des appartements.

Le flag `irl_manual` (colonne `appartement.irl_manual`) donne la **priorité à la saisie manuelle** :
- Modifier l'IRL via `PUT /appartement/{id}` ou `POST /appartement/updateValIrlTirl` avec une valeur non vide → `irl_manual = true`, l'auto-remplissage ne l'écrase plus.
- Remettre une valeur vide → `irl_manual = false`, le remplissage automatique INSEE reprend au prochain GET.

La valeur est mise en cache 6 h en mémoire (l'IRL n'est publié qu'une fois par trimestre).

---

## Déploiement sur Render (Base de données PostgreSQL)

1. Créer un compte sur **render.com** (connexion GitHub)
2. **New** → **PostgreSQL**
3. Configurer :
   - **Name** : `bailautocomplete-db`
   - **Region** : Frankfurt (EU Central)
   - **Plan** : Free
4. **Create Database**
5. Récupérer l'**Internal Database URL** dans la section Connections

L'URL fournie par Render (`postgres://USER:PASSWORD@HOST/DATABASE`) est
directement exploitable : plus besoin de la convertir en URL JDBC.

---

## Déploiement sur Koyeb (Backend NestJS)

1. Créer un compte sur **koyeb.com** (connexion GitHub)
2. **Create Service** → **Web Service**
3. Sélectionner **GitHub** et choisir le repo backend
4. Configurer :
   - **Builder** : Dockerfile
   - **Region** : Frankfurt
   - **Instance type** : Free
   - **Health check** : `GET /actuator/health`
5. Ajouter les **variables d'environnement** :

| Variable | Valeur |
|----------|--------|
| `DATABASE_URL` | `postgres://USER:PASSWORD@HOST:5432/DATABASE` |
| `DB_SSL` | `true` |
| `CORS_ORIGIN` | `https://bail-auto-complete-front.vercel.app` |

6. **Deploy**

> Avant ce premier déploiement, exécuter le **baseline** décrit plus haut sur la
> base de production.

### URL finale

```
https://relative-ammamaria-mundus09-e11bb300.koyeb.app
```

Le endpoint `/actuator/health` est conservé (il remplace celui de
spring-boot-starter-actuator) pour ne pas avoir à reconfigurer le health check.

### Démarrage à froid : `/actuator/health/readiness`

Sur un hébergement qui met le conteneur à l'échelle zéro (Scaleway Serverless
Containers), la première requête après une période d'inactivité attend le
réveil de l'instance — plusieurs secondes pendant lesquelles le front doit
afficher un écran de chargement plutôt qu'un formulaire de mot de passe qui
semble figé.

| Endpoint | Rôle | Base interrogée |
|----------|------|-----------------|
| `GET /actuator/health` | vivacité, health check de l'hébergeur | non |
| `GET /actuator/health/readiness` | disponibilité, écran de chargement du front | oui (`SELECT 1`) |

Réponses de `readiness` :

```jsonc
// 200 — l'API et la base répondent, le front peut afficher le login
{ "status": "UP", "database": "UP", "uptimeMs": 12043 }

// 503 — instance réveillée mais base pas encore joignable, le front repolle
{ "status": "STARTING", "database": "DOWN", "uptimeMs": 310 }
```

La route est publique (aucun guard) : elle est appelée avant toute
authentification. `READINESS_TIMEOUT_MS` (4000 par défaut) borne le `SELECT 1`
pour renvoyer un 503 rapide au lieu de laisser la requête pendre.

---

## Conversion des quittances en PDF

Les quittances de loyer partent au locataire en PDF, alors que le modèle reste
un `.docx` que le bailleur retouche lui-même. Le front remplit le modèle, puis
poste chaque document à `POST /documents/pdf` (route protégée par le même garde
JWT que l'envoi de mail) ; l'API le convertit avec LibreOffice et renvoie le PDF.

L'image Docker embarque `libreoffice-writer` seul — pas la suite complète — avec
la police `fonts-crosextra-carlito`, aux métriques du Calibri du modèle : sans
elle, LibreOffice substitue une autre police et la mise en page se décale.

### Mémoire et durée : le CPU est le facteur limitant, pas la RAM

Mesures prises dans l'image du projet, sur une vraie quittance remplie (82 ko),
avec les limites de production (`--memory=512m --cpus=0.25`) :

| Grandeur | Valeur mesurée |
|----------|----------------|
| Pic mémoire du cgroup (Node + `soffice`) | ~160 Mo |
| Durée d'une conversion à 250 mVCPU | 3,5 à 4,8 s |
| Durée d'une conversion sans bridage CPU | ~1,1 s |
| Taille du PDF produit | ~23 ko |

**La RAM n'est pas le problème** : 160 Mo pour la conversion, auxquels s'ajoute
l'API Node en fonctionnement — on reste largement sous les 512 Mo. Inutile de
passer à 768 Mo tant qu'aucun redémarrage pour dépassement mémoire (OOM) n'est
constaté.

**Le CPU l'est.** À 250 mVCPU, une conversion prend 3,5 à 5 s là où elle en
prend 1 sans bridage. Comme `DocumentsService` sérialise les conversions (deux
LibreOffice simultanés seraient au-dessus de la limite mémoire, et se
disputeraient un quart de cœur), une période de quatre mois demande **15 à 20 s**
au total. C'est long, mais l'écran affiche un indicateur d'attente pendant ce
temps. Si cela devient gênant, c'est le CPU du conteneur qu'il faut augmenter,
pas la mémoire.

---

## CI/CD automatique

À chaque `git push` sur la branche `master` :
1. Koyeb détecte le changement
2. Build automatique via Dockerfile
3. Déploiement automatique
4. Zero downtime

---

## Troubleshooting

### `relation "bailleur" already exists` au démarrage

Le baseline n'a pas été fait sur cette base. Lancer :

```bash
DB_MIGRATIONS_RUN=false npm run migration:baseline
```

### `column "val_irl" does not exist`

La base a été construite uniquement à partir des anciens changelogs Liquibase,
sans passer par Hibernate. Appliquer la migration
`1700000031000-AddValIrlAndTIrlToAppartement`.

### Réinitialiser la base de données (via psql)

```bash
psql "postgres://USER:PASSWORD@HOST/DATABASE"
```

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q
```

Puis `npm run migration:run` pour tout reconstruire.
