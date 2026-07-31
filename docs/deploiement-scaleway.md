# Récapitulatif — Déploiement BailAutoComplete sur Scaleway

> Backend NestJS + PostgreSQL + Frontend Angular (Vercel)
> Organisation Scaleway : **bailAuto** — Région : **Paris (PAR)**

---

## 1. Architecture globale

```
┌──────────────────┐      ┌───────────────────────┐      ┌─────────────────────┐
│     Frontend      │ ──── │   Serverless Container │ ──── │  Serverless SQL DB  │
│  Angular (Vercel)  │      │   NestJS (Scaleway)    │      │  PostgreSQL-16      │
└──────────────────┘      └───────────────────────┘      └─────────────────────┘
                                     ▲
                                     │ build & push automatique
                                     │
                          ┌───────────────────────┐
                          │   GitHub Actions        │
                          │   (branche master)      │
                          └───────────────────────┘
                                     ▲
                                     │ image Docker
                                     │
                          ┌───────────────────────┐
                          │  Container Registry     │
                          │  bailautocomplete-      │
                          │  registry               │
                          └───────────────────────┘
```

---

## 2. Base de données — Serverless SQL

| Paramètre | Valeur |
|---|---|
| Nom | `bailautocomplete-db` |
| Moteur | PostgreSQL-16 |
| Région | Paris (PAR) |
| Autoscaling vCPU | 0 – 1 |
| Coût estimé | ~4,38 €/mois (1h d'activité/jour, 1 Go stockage) |
| Connexion | Via clé IAM (pas de user/password classique) |
| Format de connexion | `postgres://[application-id]:[clé-secrète]@[host]:5432/[database]?sslmode=require` |

**Application IAM dédiée à la connexion DB** : `BailAutoComplete`
→ Policy attachée : `ServerlessSQLDatabaseFullAccess` (nécessaire pour que TypeORM crée/modifie les tables via les migrations)

---

## 3. Container Registry

| Paramètre | Valeur |
|---|---|
| Namespace | `bailautocomplete-registry` |
| Région | Paris (PAR) |
| Visibilité | Privé |
| Image | `backend` (tags : `latest` + hash du commit) |
| URL complète | `rg.fr-par.scw.cloud/bailautocomplete-registry/backend:latest` |

---

## 4. Serverless Container (backend NestJS)

| Paramètre | Valeur |
|---|---|
| Namespace de containers | `bailauto-containers` |
| Nom du container | `bailauto-backend` |
| Port | `8080` |
| Ressources | 512 MB RAM / 250 mvCPU |
| Autoscaling | min 0 — max 2 instances |
| Concurrence max/instance | 80 requêtes |
| Health check | HTTP sur `/actuator/health` (interval 10s, seuil d'échec 30) |
| Coût estimé | ~0,77 €/mois (2h d'activité/jour) |
| URL publique | `https://bailautocontainers5e6cf272-bailauto-backend.functions.fnc.fr-par.scw.cloud` |

### Variables d'environnement (classiques)

| Clé | Valeur |
|---|---|
| `DB_SSL` | `true` |
| `DB_MIGRATIONS_RUN` | `true` |
| `CORS_ORIGIN` | `https://bail-auto-complete-front.vercel.app` |

⚠️ `PORT` ne doit **jamais** être défini manuellement — Scaleway l'injecte automatiquement.

### Secret

| Clé | Valeur |
|---|---|
| `DATABASE_URL` | Chaîne de connexion complète vers `bailautocomplete-db` |

---

## 5. CI/CD — GitHub Actions

- **Fichier** : `.github/workflows/deploy.yml`
- **Déclencheur** : push sur la branche `master`
- **Étapes actuelles** : build de l'image Docker → push vers le Container Registry
- **Étape de redéploiement automatique** : présente dans le fichier mais **commentée** — à activer en ajoutant le secret `CONTAINER_ID` (`e776b58b-130d-4958-aa72-a31f39ffd...`)

### Secrets GitHub configurés

| Nom du secret | Rôle |
|---|---|
| `SCW_SECRET_KEY` | Authentification Scaleway (application `ci-github-actions`) |
| `CONTAINER_REGISTRY_ENDPOINT` | `rg.fr-par.scw.cloud/bailautocomplete-registry` |
| `CONTAINER_ID` *(à ajouter)* | ID du Serverless Container, pour activer le redéploiement auto |

### Application IAM dédiée au CI

`ci-github-actions` → Policy : `ContainerRegistryFullAccess` + `ContainersFullAccess`

---

## 6. Sécurité & coûts

- **Alerte de facturation** créée : budget 10 €/mois (email)
  - ⚠️ Rappel : une alerte de facturation **informe** mais **ne bloque pas** la consommation
- **Vrais plafonds anti-emballement des coûts** :
  - Base de données : max 1 vCPU
  - Container : max 2 instances, 250 mvCPU / 512 MB
- **Secrets sensibles** (`DATABASE_URL`) stockés en tant que *Secret* (et non variable classique) dans le container

---

## 7. Coût total estimé

| Poste | Coût mensuel estimé |
|---|---|
| Base de données Serverless SQL | ~4,38 € |
| Serverless Container | ~0,77 € |
| Container Registry | ~0,06 € (usage très faible) |
| **Total** | **~5,20 €/mois** |

*(Ces montants sont des estimations basées sur une hypothèse d'usage modéré — la facture réelle dépend du trafic effectif.)*

---

## 8. Prochaines étapes possibles

- [ ] Tester les endpoints métier réels de l'API (pas juste `/actuator/health`)
- [ ] Mettre à jour `environment.prod.ts` côté Angular avec l'URL du backend
- [ ] Activer le redéploiement automatique dans GitHub Actions (ajouter `CONTAINER_ID`)
- [ ] Une fois validé, aligner le déclencheur du workflow sur la vraie branche de prod (`master`) si ce n'est pas déjà fait
- [ ] Envisager de déplacer le frontend Angular sur Scaleway (Object Storage + CDN) si tu veux tout centraliser

---

*Fiche générée le 31 juillet 2026 — à conserver comme référence pour toute maintenance future.*
