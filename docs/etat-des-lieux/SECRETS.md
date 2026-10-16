# Secrets

## Le plus simple (recommandé ici)

Il n'y avait pas de gestionnaire de secrets dédié dans le projet : les secrets sont déjà des **variables
d'environnement injectées au démarrage du conteneur**. Je les garde : **zéro dépendance, zéro code en plus**.
Chez l'hébergeur, saisir les variables 🔒 de [VARIABLES.md](VARIABLES.md) comme **variables secrètes**
(Scaleway Serverless Containers : *secret environment variables* / Secret Manager ; Koyeb : *Secrets*) — elles
sont chiffrées au repos et masquées dans l'interface.

Si un jour il faut aller plus loin (rotation automatique, audit d'accès) : Infisical ou Doppler se branchent sans
changer le code, car ils injectent… des variables d'environnement. Un SDK Key Vault ne serait utile que si vous
passiez sur Azure.

## Les trois secrets du module

| Secret | Générer | Si on le change |
|---|---|---|
| `EDL_TOKEN_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` | **tous les liens en circulation cessent de marcher** → en créer de nouveaux (« Nouveau lien ») |
| `EDL_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | le refresh token stocké devient illisible → **reconnecter OneDrive** (rien d'autre n'est perdu) |
| `ONEDRIVE_CLIENT_SECRET` | portail Azure → *Certificats et secrets* | créer le nouveau secret, mettre à jour la variable, supprimer l'ancien. **Pas de reconnexion nécessaire**. Il expire (24 mois max) : noter la date |

## Règles

- Jamais de valeur secrète dans le dépôt, un `.env` versionné, un log ou un message de commit. `.env` est dans `.gitignore`.
- Les logs n'écrivent ni jeton, ni signature, ni commentaire, ni refresh token (contrôlé par un test e2e).
- Un secret exposé par erreur : le changer **tout de suite** (voir tableau), puis chercher où il a fuité.
- Pour vérifier qu'aucun secret n'est versionné : `git log -p -S'ONEDRIVE_CLIENT_SECRET=' -- '*.env*'` ne doit rien montrer de renseigné.
