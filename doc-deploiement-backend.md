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

> **Mise à jour du 21/10/2026.** La production tourne sur **Scaleway** : le
> backend dans un Serverless Container (région Paris, de 0 à 2 instances, il
> s'éteint quand personne ne l'utilise) et la base dans une **Serverless SQL
> Database** PostgreSQL 16 (région Paris). Les sections Render et Koyeb plus bas
> sont conservées pour mémoire : elles ne décrivent plus la production.

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
| `DB_SSL` | non | déduit de `sslmode=require` | Force le SSL (requis par les bases hébergées : Scaleway, Render) |
| `DB_SSL_CA` | recommandé | — | Certificat de l'autorité de la base (PEM, ou chemin de fichier). Active la vérification du certificat |
| `DB_SSL_VERIFY` | non | `false` | `true` : vérifie le certificat avec les autorités publiques du système (sans `DB_SSL_CA`). Sans l'un ni l'autre, un avertissement est journalisé au démarrage |
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
| `AUTH_OWNER_EMAIL` | pour le lien de connexion par email | — | Adresses autorisées à recevoir un lien, séparées par des virgules (`a@x.fr,b@y.fr`). Seules ces adresses reçoivent un mail ; toutes ouvrent le même compte. Vide : lien de connexion désactivé |
| `TRUST_PROXY` | **en production derrière un proxy** | — | Nombre de proxys devant l'API (`1` sur Scaleway). Sans lui, la limitation de débit et le verrou de connexion voient l'IP du proxy : tous les visiteurs partagent le même quota |

| `ENCRYPTION_KEY` | **oui** | — | Clé de chiffrement des colonnes personnelles (32 octets en base64). **L'API refuse de démarrer sans.** Variable **secrète**, aussi rangée dans un gestionnaire de mots de passe : la perdre fait perdre les données chiffrées. Voir le README |
| `ENCRYPTION_KEY_PREVIOUS` | non | — | Ancienne clé, **en lecture seule**, pendant un changement de clé |
| `PURGE_LOCATAIRES` | non | absente (purge désactivée) | `true` : supprime au démarrage les locataires sortis depuis plus de 3 ans (RGPD). **Définitif.** Voir le README, section RGPD |

`AUTH_OWNER_EMAIL` reçoit aussi le mail de rappel envoyé après chaque purge. Les
variables `MAIL_*` doivent être posées pour qu'il parte.

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
npm run purge:locataires    # RGPD : essai à blanc de la purge (n'écrit rien)
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

## Base de données Scaleway (Serverless SQL Database)

C'est la base de production. Elle se connecte comme un PostgreSQL ordinaire,
avec des identifiants particuliers :

| Élément | Valeur |
|---|---|
| Hôte | `<DATABASE_ID>.pg.sdb.fr-par.scw.cloud` (l'identifiant de la base est affiché sur sa page) |
| Port / base | `5432` / `bailautocomplete-db` |
| Utilisateur | l'**identifiant de l'application IAM** (un UUID), pas l'« access key » `SCW…` |
| Mot de passe | la **clé secrète** (Secret key) d'une clé API de cette application |
| Chiffrement | obligatoire : `?sslmode=require` |

```
postgres://<APPLICATION_ID>:<CLE_SECRETE>@<DATABASE_ID>.pg.sdb.fr-par.scw.cloud:5432/bailautocomplete-db?sslmode=require
```

Cette URL est la valeur de `DATABASE_URL` du conteneur : à enregistrer comme
**variable secrète**, pas comme variable normale (une variable normale se relit en
clair dans la console).

### La clé secrète

- Elle ne s'affiche qu'**une seule fois**, à la création de la clé API : la copier
  aussitôt. Perdue, elle ne se récupère pas, il faut en créer une autre.
- Elle **expire au bout d'un an au plus** : une clé expirée coupe l'accès de
  l'application à la base. Poser un rappel dans l'agenda avant l'échéance.
- Ne jamais la taper dans une commande (elle resterait dans l'historique du
  terminal), ni la coller dans une conversation ou une capture d'écran.

### Changer la clé sans coupure

1. IAM, API keys, **Generate API key** : choisir la **même application** que
   l'ancienne clé (mêmes droits, même utilisateur), copier la clé secrète.
2. Tester la nouvelle URL avec `psql` (voir plus bas).
3. Remplacer `DATABASE_URL` dans les variables du conteneur et redéployer.
4. Vérifier que l'API répond (statut Ready, connexion possible).
5. **Seulement alors**, supprimer l'ancienne clé. Créer une clé n'invalide pas
   l'ancienne : seule sa suppression coupe son accès. Ne pas supprimer la clé
   de l'application `ci-github-actions`, qui sert au déploiement.

### Erreurs de connexion courantes

| Message | Cause |
|---|---|
| `password authentication failed for user "SCW…"` | L'utilisateur envoyé est une access key : il faut l'identifiant (UUID) de l'application |
| `Database hostname wasn't sent to server` | Seconde tentative sans chiffrement après un premier échec : forcer `sslmode=require` (ou ajouter `?options=databaseid%3D<DATABASE_ID>` à l'URL, comme l'indique le message) |
| `no password supplied` | La variable `PGPASSWORD` est vide dans le terminal |

### Sauvegarder la production, et répéter une opération sur une copie

La version 14 de `psql` et de `pg_dump` installée sur le poste refuse de lire une
base 16 : passer par Docker avec une image de la même version.

```bash
read -rs PGPASSWORD && export PGPASSWORD      # coller la clé secrète, Entrée (rien ne s'affiche)
APP_ID='<APPLICATION_ID>'

docker run --rm -e PGPASSWORD -e PGSSLMODE=require postgres:16-alpine \
  pg_dump -h <DATABASE_ID>.pg.sdb.fr-par.scw.cloud -p 5432 -U "$APP_ID" \
  -d bailautocomplete-db --no-owner --no-acl > ~/sauvegarde-bailauto.sql
```

Restaurer dans une base jetable, puis y répéter la purge :

```bash
docker run -d --name pg-prod-copy -e POSTGRES_PASSWORD=jetable -p 5440:5432 postgres:16-alpine
docker exec pg-prod-copy createdb -U postgres bailauto_copy
docker exec -i pg-prod-copy psql -U postgres -d bailauto_copy < ~/sauvegarde-bailauto.sql

DATABASE_URL='postgres://postgres:jetable@localhost:5440/bailauto_copy' npm run purge:locataires
```

Ces fichiers contiennent les **données réelles de tous les locataires** (en clair
tant que le chiffrement n'est pas en production ; ensuite chiffrées, et ils ne
servent qu'avec la même `ENCRYPTION_KEY`) : les
garder hors du projet (jamais dans git), puis les supprimer après usage
(`docker rm -f pg-prod-copy` et le fichier `.sql`). Ne pas démarrer l'API contre
cette copie avec un vrai serveur SMTP : elle contient de vraies adresses.

## Mise en production du chiffrement des colonnes

À suivre **dans l'ordre**. Le point délicat : l'API refuse de démarrer sans
`ENCRYPTION_KEY`, et les données ne sont chiffrées qu'après le déploiement.

```
1 clé ─► 2 sauvegarde ─► 3 répétition sur copie ─► 4 variable Scaleway ─► 5 déploiement
      ─► 6 vérification ─► 7 chiffrement des données ─► 8 contrôle ─► 9 nettoyage
```

1. **Générer la clé** (commande du README) et la ranger tout de suite dans un
   gestionnaire de mots de passe. Ne pas la taper dans une commande ni la coller
   dans un échange.
2. **Sauvegarder la production** (section précédente). Ce dump contient les données
   en clair : c'est le filet de sécurité, à supprimer à l'étape 9.
3. **Répéter sur une copie jetable** : restaurer ce dump dans la base Docker de test,
   puis, avec une clé de test, `npm run chiffrer:donnees` (essai à blanc) puis
   `-- --execute`. Vérifier que l'application lit toujours (purge d'essai, API).
4. **Poser `ENCRYPTION_KEY`** comme variable **secrète** du conteneur Scaleway,
   *avant* de déployer.
5. **Déployer** le code. Au démarrage, la migration passe les colonnes en texte ;
   l'application lit les données encore en clair et chiffre toute nouvelle écriture.
   Le journal affiche « empreinte de la clé : xxxxxxxx » : la noter.
6. **Vérifier l'application** : liste des locataires, ouverture d'une fiche, génération
   d'un document.
7. **Chiffrer les données existantes**, depuis le poste, avec la même clé :

   ```bash
   read -rs ENCRYPTION_KEY && export ENCRYPTION_KEY   # coller la clé, Entrée
   read -rs DATABASE_URL && export DATABASE_URL       # coller l'URL de la base, Entrée
   npm run chiffrer:donnees                           # essai à blanc
   npm run chiffrer:donnees -- --execute
   ```

   **Comparer l'empreinte affichée à celle du journal de l'API** : si elles
   diffèrent, s'arrêter, la clé n'est pas la même.
8. **Contrôler** : l'application affiche toujours les noms ; dans l'extension SQL, les
   colonnes concernées montrent `enc:v1:…`. Prendre un nouveau dump : il est désormais
   chiffré.
9. **Nettoyer** : supprimer les dumps d'avant le chiffrement et la copie Docker ; les
   sauvegardes automatiques Scaleway d'avant le chiffrement contiennent encore les
   données en clair jusqu'à leur expiration (vérifier leur durée).

En cas de problème à l'étape 7 : rien n'est validé si une valeur ne se relit pas
correctement, et le script est rejouable. Ne pas revenir en arrière après le
chiffrement (la migration de types n'est plus réversible) : corriger la clé.

## Déploiement sur Render (Base de données PostgreSQL)

> Historique : la production n'est plus sur Render (voir la mise à jour en haut).

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

> Historique : la production n'est plus sur Koyeb (voir la mise à jour en haut).

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

En production sur Scaleway, les logs du 14/09/2026 montrent plutôt **13 s par
conversion** : douze quittances demandent près de 3 minutes.

### Envoi par mail : une seule requête

`POST /documents/envoyer` (multipart : `to`, `subject`, `text`, et jusqu'à douze
`.docx` dans `documents`) convertit les documents puis envoie le mail, en une
requête. Le front l'utilise pour l'envoi des quittances.

Avant, le navigateur demandait chaque conversion puis le mail : un onglet
rechargé pendant les 3 minutes (téléphone verrouillé, retour à l'accueil)
abandonnait tout, sans mail ni erreur visible. Désormais, une fois la requête
reçue, le serveur va au bout même si le client se déconnecte. Chaque mail parti
laisse une ligne `Mail envoyé (id …)` dans les logs, sans l'adresse du destinataire (RGPD).

Le **timeout HTTP du conteneur** (réglage Scaleway, 10 s à 60 min) doit couvrir
douze conversions et l'envoi : 5 minutes au moins. En deçà, le front reçoit un
504 alors que le mail part quand même ; il le signale comme tel plutôt que
d'inviter à renvoyer.

`POST /documents/pdf`, une conversion par requête, reste utilisé par le
téléchargement des quittances, qui a besoin des PDF dans le navigateur.

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
