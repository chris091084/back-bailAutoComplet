# Documentation Déploiement Backend - BailAutoComplete

## Stack technique

- **Framework** : NestJS 11
- **Node** : 20
- **Base de données** : PostgreSQL
- **ORM** : TypeORM 0.3 (`synchronize` désactivé, schéma piloté par les migrations)
- **Migrations** : migrations TypeORM (`src/database/migrations`)
- **Build** : npm / `nest build`, image Docker poussée sur le Container Registry Scaleway
- **Hébergement** : Scaleway Serverless Container (région Paris, `fr-par`)
- **Base de données hébergée** : Scaleway Serverless SQL (PostgreSQL-16)

> Le backend était auparavant en Spring Boot 3.3 / Java 17 / Maven / Liquibase.
> Le contrat HTTP est inchangé : mêmes routes, mêmes charges utiles JSON.
>
> L'hébergement était auparavant sur Koyeb (backend) et Render (base de données) ;
> tout est désormais sur Scaleway, organisation **bailAuto**, région **Paris (PAR)**.
> Le détail de l'infrastructure Scaleway est dans [docs/deploiement-scaleway.md](docs/deploiement-scaleway.md).

---

## Architecture de déploiement

```
┌─────────────────┐      ┌──────────────────────────┐      ┌──────────────────────┐
│    Frontend     │ ──── │   Serverless Container   │ ──── │    Serverless SQL    │
│    (Vercel)     │      │     bailauto-backend     │      │  bailautocomplete-db │
└─────────────────┘      └──────────────────────────┘      └──────────────────────┘
                                      ▲
                                      │ image Docker
                         ┌──────────────────────────┐
                         │    Container Registry    │
                         │ bailautocomplete-registry│
                         └──────────────────────────┘
                                      ▲
                                      │ build & push
                         ┌──────────────────────────┐
                         │      GitHub Actions      │
                         └──────────────────────────┘
```

---

## Variables d'environnement

| Variable | Obligatoire | Défaut | Rôle |
|----------|-------------|--------|------|
| `DATABASE_URL` | en production | — | URL de connexion, forme `postgres://user:pass@hote:5432/base` **ou** `jdbc:postgresql://hote:5432/base?user=…&password=…`. Sur Scaleway Serverless SQL : `postgres://[application-id]:[clé-secrète]@[host]:5432/[database]?sslmode=require` |
| `DB_USERNAME` / `DB_PASSWORD` | si absents de l'URL | `postgres` / `root` | Identifiants |
| `DB_HOST` / `DB_PORT` / `DB_NAME` | en local | `localhost` / `5432` / `bailAutoComplete` | Connexion locale quand `DATABASE_URL` n'est pas défini |
| `DB_SSL` | non | déduit de `sslmode=require` | Force le SSL (requis par Serverless SQL) |
| `DB_MIGRATIONS_RUN` | non | `true` | Applique les migrations au démarrage, comme le faisait Liquibase |
| `DB_LOGGING` | non | `false` | Trace le SQL |
| `CORS_ORIGIN` | oui | `http://localhost:4200` | Origine autorisée |
| `PORT` | non | `8080` | Port d'écoute. **Ne jamais le définir à la main sur le Serverless Container** : Scaleway l'injecte lui-même |
| `INSEE_BDM_BASE_URL` | non | service SDMX public | Endpoint INSEE |
| `INSEE_IRL_IDBANK` | non | `001515333` | Série IRL |
| `INSEE_IRL_CACHE_TTL_HOURS` | non | `6` | Durée du cache IRL |

Un gabarit complet est fourni dans `.env.example`.

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

## Déploiement sur Scaleway — Base de données (Serverless SQL)

1. Console Scaleway → **Serverless** → **Serverless SQL Databases**
2. Créer la base :
   - **Nom** : `bailautocomplete-db`
   - **Moteur** : PostgreSQL-16
   - **Région** : Paris (PAR)
   - **Autoscaling vCPU** : 0 – 1 (le 0 permet la mise en veille, le 1 plafonne le coût)
3. La connexion se fait par **clé IAM**, pas par un couple utilisateur/mot de passe :
   créer une application IAM dédiée (`BailAutoComplete`) et lui attacher la policy
   **`ServerlessSQLDatabaseFullAccess`** — nécessaire pour que TypeORM puisse
   créer et modifier les tables via les migrations.
4. Récupérer la chaîne de connexion :

```
postgres://[application-id]:[clé-secrète]@[host]:5432/[database]?sslmode=require
```

`sslmode=require` est obligatoire ; le code en déduit `DB_SSL=true`.

---

## Déploiement sur Scaleway — Backend (Serverless Container)

L'image Docker est construite par GitHub Actions et poussée sur le **Container
Registry** avant d'être déployée (voir la section CI/CD plus bas).

### Container Registry

| Paramètre | Valeur |
|----------|--------|
| Namespace | `bailautocomplete-registry` (privé, région PAR) |
| Image | `backend`, taguée `latest` + hash du commit |
| URL | `rg.fr-par.scw.cloud/bailautocomplete-registry/backend:latest` |

### Container

1. Console Scaleway → **Serverless** → **Containers** → namespace `bailauto-containers`
2. Créer le container à partir de l'image du registry :

| Paramètre | Valeur |
|----------|--------|
| Nom | `bailauto-backend` |
| Port | `8080` |
| Ressources | 512 MB RAM / 250 mvCPU |
| Autoscaling | min 0 — max 2 instances |
| Concurrence max par instance | 80 requêtes |
| Health check | HTTP `GET /actuator/health` (intervalle 10 s, seuil d'échec 30) |

3. **Variables d'environnement** :

| Variable | Valeur |
|----------|--------|
| `DB_SSL` | `true` |
| `DB_MIGRATIONS_RUN` | `true` |
| `CORS_ORIGIN` | `https://bail-auto-complete-front.vercel.app` |

4. **Secret** (et non variable classique, pour ne pas exposer les identifiants) :

| Secret | Valeur |
|--------|--------|
| `DATABASE_URL` | chaîne de connexion complète vers `bailautocomplete-db` |

> ⚠️ Ne pas définir `PORT` : Scaleway l'injecte et une valeur manuelle casse le
> démarrage.

> Avant ce premier déploiement, exécuter le **baseline** décrit plus haut sur la
> base de production.

### URL finale

```
https://bailautocontainers5e6cf272-bailauto-backend.functions.fnc.fr-par.scw.cloud
```

Le endpoint `/actuator/health` est conservé (il remplace celui de
spring-boot-starter-actuator) pour ne pas avoir à reconfigurer le health check.

---

## CI/CD — GitHub Actions

Workflow : [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

À chaque `git push` sur la branche de déploiement :
1. Checkout du code
2. Connexion au Container Registry Scaleway (`docker/login-action`, utilisateur
   `nologin`, mot de passe = `SCW_SECRET_KEY`)
3. Build de l'image via le `Dockerfile`, taguée `:latest` et `:${{ github.sha }}`
4. Push des deux tags vers le registry
5. *(commenté)* Redéploiement du Serverless Container sur la nouvelle image

> ⚠️ Le déclencheur est actuellement `branches: [master1]` — le workflow ne se
> lance donc **jamais**. Le remettre sur `master` pour activer la CI.

> L'étape 5 est commentée : la décommenter après avoir ajouté le secret
> `CONTAINER_ID` (ID du Serverless Container). Sans elle, l'image est bien
> publiée mais le container continue de tourner sur l'ancienne version — il faut
> le redéployer à la main depuis la console.

### Secrets GitHub

| Secret | Rôle |
|--------|------|
| `SCW_SECRET_KEY` | Clé secrète de l'application IAM `ci-github-actions` |
| `CONTAINER_REGISTRY_ENDPOINT` | `rg.fr-par.scw.cloud/bailautocomplete-registry` |
| `CONTAINER_ID` *(à ajouter)* | ID du Serverless Container, pour le redéploiement auto |

L'application IAM `ci-github-actions` porte les policies
`ContainerRegistryFullAccess` et `ContainersFullAccess`.

---

## Coûts et garde-fous

| Poste | Coût mensuel estimé |
|-------|---------------------|
| Serverless SQL (1 h d'activité/jour, 1 Go) | ~4,38 € |
| Serverless Container (2 h d'activité/jour) | ~0,77 € |
| Container Registry | ~0,06 € |
| **Total** | **~5,20 €/mois** |

Estimations pour un usage modéré ; la facture réelle suit le trafic.

Une alerte de facturation à 10 €/mois est configurée, mais une alerte
**informe sans bloquer**. Les vrais plafonds sont les limites d'autoscaling :
1 vCPU max sur la base, 2 instances × 250 mvCPU / 512 MB sur le container.

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
