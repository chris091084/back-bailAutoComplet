# Connexion OneDrive (stockage des photos)

Les photos des états des lieux sont rangées dans **un dossier dédié de votre OneDrive personnel**
(`Applications/<nom de l'application Azure>/`). Le locataire ne voit jamais Microsoft : les images
passent par l'API.

```
 locataire ──photo──► API ──Microsoft Graph──► OneDrive du bailleur
                        │                       /Applications/BailAuto/
                        │                         └─ {adresse}/{locataire}/{entree|sortie}/{piece}/{element}-{date}-{id}.jpg
                        └─ base de données : seulement l'identifiant du fichier et son lien
```

> **Pourquoi le flux « délégué » ?** Pour un compte Microsoft *personnel*, les permissions
> « application » (client credentials) n'existent pas. Vous vous connectez donc **une fois** ; le
> serveur garde un *refresh token* (jeton de renouvellement) **chiffré** et renouvelle seul l'accès.

## 1. Inscrire l'application dans Azure (une seule fois)

> Les libellés du portail Microsoft évoluent ; les étapes ci-dessous donnent l'idée générale.

1. Aller sur <https://portal.azure.com> → **Microsoft Entra ID** → **Inscriptions d'applications** → **Nouvelle inscription**.
2. **Nom** : `BailAuto` (c'est aussi le nom du dossier créé dans OneDrive).
3. **Types de comptes pris en charge** : *Comptes Microsoft personnels uniquement*.
4. **URI de redirection** → plateforme **Web** :
   - production : `https://<adresse-de-l-api>/onedrive/callback`
   - développement : `http://localhost:8081/onedrive/callback` (à ajouter aussi)
5. **Certificats et secrets** → **Nouveau secret client** → copier immédiatement sa **valeur**
   (elle n'est affichée qu'une fois). Il expire (24 mois maximum) : prévoir son renouvellement.
6. **Autorisations d'API** → **Microsoft Graph** → **Autorisations déléguées** → ajouter :
   - `Files.ReadWrite.AppFolder` (le dossier applicatif **uniquement**)
   - `offline_access` (le renouvellement automatique)
   
   **Ne jamais ajouter** `Files.ReadWrite.All` : l'application n'a pas besoin de voir le reste de votre OneDrive.
7. Noter l'**ID d'application (client)** de la page *Vue d'ensemble*.

## 2. Poser les variables d'environnement

| Variable | Valeur | Secret ? |
|---|---|---|
| `ONEDRIVE_CLIENT_ID` | ID d'application (client) | non |
| `ONEDRIVE_CLIENT_SECRET` | valeur du secret client | **oui** |
| `ONEDRIVE_REDIRECT_URI` | exactement l'URI déclarée à l'étape 1.4 | non |
| `EDL_ENCRYPTION_KEY` | 32 octets en base64 (voir ci-dessous) | **oui** |

Générer la clé de chiffrement :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Les valeurs secrètes se posent dans le gestionnaire de secrets / les variables de l'hébergeur
(voir `SECRETS.md`), **jamais** dans le dépôt ni dans un `.env` versionné.

## 3. Connecter

1. Ouvrir l'application → menu **OneDrive**.
2. **Connecter OneDrive** → Microsoft demande votre accord → retour sur la page, « Connecté ».

C'est tout : à partir de là, chaque photo prise par un locataire est rangée automatiquement.

## Si quelque chose se passe mal

Une photo n'est **jamais perdue** : si OneDrive refuse, elle reste sur le téléphone du locataire
(indicateur orange « en attente ») et repart toute seule quand ça marche à nouveau.

| Symptôme | Cause | Que faire |
|---|---|---|
| Page OneDrive : « Non configuré sur le serveur » | une des 4 variables manque | les poser puis redémarrer |
| « Accès retiré » | mot de passe Microsoft changé, application révoquée, secret expiré | **Connecter OneDrive** à nouveau |
| Photos « en attente » longtemps | OneDrive non connecté, plein (507) ou limite de débit (429) | connecter / libérer de la place / attendre : le `Retry-After` de Microsoft est respecté |
| Erreur au retour de Microsoft | URI de redirection différente de celle d'Azure | elles doivent être identiques au caractère près |

Changer `EDL_ENCRYPTION_KEY` rend le jeton stocké illisible : il suffit alors de reconnecter OneDrive.
