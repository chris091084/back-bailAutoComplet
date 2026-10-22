# bail-auto-complet — API back-end

## Prérequis

- Node.js (v18+)
- Docker (avec le projet front `bailAutoComplete-Front` cloné et son conteneur db créé)

---

## Première installation

### 1. Démarrer la base de données

Le projet utilise le Postgres du projet front, lancé via Docker :

```bash
sudo docker start bailautocomplete-front-db-1
```

> Le conteneur expose Postgres sur le port **5433** (pas 5432).

### 2. Configurer l'environnement

```bash
cp .env.example .env
```

Puis éditer `.env` pour renseigner les secrets JWT :

```bash
# Générer JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# Générer JWT_REFRESH_SECRET (relancer la commande pour une valeur différente)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Coller les deux valeurs dans `.env` :

```
JWT_ACCESS_SECRET=<valeur générée>
JWT_REFRESH_SECRET=<valeur générée différente>
```

### 3. Installer les dépendances

```bash
npm install
```

### 4. Créer la base de données

```bash
sudo docker exec -e PGPASSWORD=root bailautocomplete-front-db-1 \
  psql -U postgres -c "CREATE DATABASE bailautocomplet_dev;"
```

### 5. Lancer les migrations

```bash
npm run migration:run
```

### 6. Définir le mot de passe de l'API

```bash
npm run auth:seed
```

Le script demande un mot de passe (saisie masquée) et le stocke haché en base.
Aucune route HTTP ne permet de le modifier — relancer ce script pour en changer.

### 7. Démarrer l'API

```bash
npm run start:dev
```

L'API écoute sur **http://localhost:8081**.

---

## Utilisations courantes

| Commande | Description |
|---|---|
| `sudo docker start bailautocomplete-front-db-1` | Démarrer la base de données |
| `npm run start:dev` | Lancer l'API en mode développement (hot reload) |
| `npm run migration:run` | Appliquer les migrations en attente |
| `npm run migration:generate -- src/migrations/NomMigration` | Générer une nouvelle migration |
| `npm run auth:seed` | Changer le mot de passe de l'API |
| `npm run chiffrer:donnees` | RGPD : essai à blanc du chiffrement des données existantes (compte, n'écrit rien) |
| `npm run chiffrer:donnees -- --execute` | RGPD : chiffre les données existantes, ou les rechiffre après un changement de clé |
| `npm run purge:locataires` | RGPD : essai à blanc de la purge (compte, ne supprime rien) |
| `npm run purge:locataires -- --execute` | RGPD : supprime pour de bon les locataires sortis depuis plus de 3 ans |
| `npm run test` | Lancer les tests |

---

## RGPD : suppression des données

Le registre des traitements (`doc-registre-traitements.md`) décrit quelles
données sont traitées, pourquoi, pour combien de temps, et où elles se trouvent.
À tenir à jour à chaque changement qui touche aux données personnelles.

### Qui est supprimé, et quand

| Cas | Suppression |
|---|---|
| **Candidat** (bail généré, jamais signé) | À la main : onglet Candidats, bouton « Supprimer » (`DELETE /locataire/:id`, refusé pour un locataire signé ou sorti) |
| **Locataire en place** | Jamais : il sort, il ne se supprime pas |
| **Locataire sorti depuis plus de 3 ans** | Automatique (purge), sauf si le commutateur « Ne pas supprimer » est activé (litige en cours, conservation plus longue) |

Trois ans : prescription des actions nées d'un bail (loi du 6 juillet 1989,
art. 7-1, rendu applicable aux meublés par l'art. 25-3 et au bail mobilité par
l'art. 25-12). Les pièces comptables et fiscales peuvent se garder plus longtemps
(elles ne sont pas stockées par l'application).

### La purge

Une fiche est supprimée si **les quatre** conditions sont vraies : état `sorti`,
date de sortie renseignée, sortie il y a plus de 3 ans, et
`conservation_prolongee` à faux. Avec la fiche partent son bail (`result_form`,
sauf s'il sert encore à un autre locataire) et son historique de génération
(`generation`). Rien d'autre n'est touché : ni candidats, ni locataires en
place, ni appartements, ni comptes. Le tout se fait dans une seule transaction.

```bash
npm run purge:locataires               # essai à blanc : compte, n'écrit rien
npm run purge:locataires -- --execute  # suppression, définitive
```

Elle se lance aussi **au démarrage de l'API** quand `PURGE_LOCATAIRES=true`
(désactivée par défaut). Pas de cron : l'hébergeur met le conteneur à l'échelle
zéro, mais il redémarre à chaque réveil, et la purge est sans effet quand rien
n'est échu. À activer seulement après le déploiement du code (la migration
`conservation_prolongee` doit être passée), et après un essai à blanc sur une
copie de la production (voir `doc-deploiement-backend.md`).

### Rappel après chaque purge

Si au moins une fiche est supprimée, un mail part aux adresses de
`AUTH_OWNER_EMAIL`, sans copie cachée : la liste des personnes supprimées avec
leurs adresses. Il reste à effacer à la main leurs échanges (mails, SMS, papiers).
Le mail contient ces adresses : une recherche Gmail le retrouve avec le reste,
il se supprime avec eux. Un échec d'envoi n'annule pas la purge (il est journalisé
sans donnée personnelle) ; sans `AUTH_OWNER_EMAIL`, aucun rappel ne part.

### Exception : « Ne pas supprimer »

`PUT /locataire/:id/conservation` avec `{ "prolongee": true | false }`, réservé
aux locataires sortis. Dans l'interface : onglet Locataires sortis, commutateur
« Ne pas supprimer ».

### Une demande d'effacement

Voir les sections 6 et 6 bis du registre : réponse sous 1 mois, refus motivé
possible, et effacement dans **tous** les endroits (base, boîte Gmail, sauvegardes,
téléphone, papiers), pas seulement dans la base.

---

## Chiffrement des colonnes personnelles

Les données personnelles sont chiffrées (AES-256-GCM) **avant** d'entrer en base et
déchiffrées à la lecture. La base, ses sauvegardes et ses dumps ne contiennent que
du texte illisible sans la clé `ENCRYPTION_KEY`.

| Table | Colonnes chiffrées |
|---|---|
| `locataire` | `nom`, `prenom`, `telephone`, `email`, `date_naissance`, `profession` |
| `result_form` (le bail) | `name`, `firstname`, `email`, `telephone`, `adress`, `motif` |
| `generation` | `locataire_name` |

Restent **en clair** : ce que le code trie, filtre ou purge (`etat`, `entree`,
`sortie`, `conservation_prolongee`), les dates et montants du bail, la chambre, et
les données du bailleur. Une colonne chiffrée ne se recherche ni ne se trie en SQL ;
l'application déchiffre à la lecture, le reste du code voit du texte ordinaire.

### La clé

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- `ENCRYPTION_KEY` est **obligatoire** : l'API refuse de démarrer sans, et au
  démarrage elle journalise une **empreinte** de la clé (8 caractères du SHA-256,
  non réversibles).
- **Perdre la clé, c'est perdre définitivement les données chiffrées.** La ranger
  dans un gestionnaire de mots de passe, en plus de la variable secrète de
  l'hébergeur ; jamais dans git, jamais au même endroit qu'un dump.
- En local, ajouter une clé à `.env` : `echo "ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" >> .env`.
- Ne jamais changer la clé en la remplaçant simplement : tout deviendrait illisible
  (voir la rotation plus bas).

### Chiffrer les données déjà en base

```bash
npm run chiffrer:donnees               # essai à blanc : compte, n'écrit rien
npm run chiffrer:donnees -- --execute  # chiffre, en une seule transaction
```

Rejouable sans risque (une valeur déjà chiffrée n'est pas retouchée) ; chaque valeur
est relue et comparée avant validation. Le script affiche l'**empreinte** de la clé :
elle doit être identique à celle du journal de démarrage de l'API, sinon on
chiffre avec une autre clé que celle de l'API. Il applique aussi les migrations en
attente (les colonnes doivent d'abord passer en texte).

### Changer de clé

1. Mettre l'ancienne clé dans `ENCRYPTION_KEY_PREVIOUS` et la nouvelle dans
   `ENCRYPTION_KEY` (l'API lit alors les deux, écrit avec la nouvelle).
2. `npm run chiffrer:donnees -- --execute` : rechiffre tout avec la nouvelle clé.
3. Vérifier, puis retirer `ENCRYPTION_KEY_PREVIOUS`.

### Dumps et copies

Un `pg_dump` copie le texte chiffré tel quel : le fichier est **illisible sans la
clé**, ce qui le rend bien moins dangereux, mais il ne sert (restauration, purge
d'essai, API) qu'avec la même `ENCRYPTION_KEY`. Les dumps faits **avant** le
chiffrement contiennent les données en clair : à supprimer. Mise en production :
voir `doc-deploiement-backend.md`.

### Ce que cela ne protège pas

La clé vit dans le même conteneur que l'accès à la base : cela protège d'une fuite
de la base, d'une sauvegarde ou d'un dump, pas d'une prise de contrôle de
l'application ni de la console de l'hébergeur. Les courriers envoyés (Gmail) ne
sont pas concernés.
