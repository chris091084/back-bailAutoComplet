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
| `npm run test` | Lancer les tests |
