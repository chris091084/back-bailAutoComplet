# Lancer et tester en local

## Prérequis

- **Node 20** pour le back, **Node ≥ 22.22** pour le front (`nvm use 22`).
- **Postgres** : celui du front (`docker start bailautocomplete-front-db-1`, port 5433).
- **Chrome ou Chromium** pour fabriquer les PDF (`PUPPETEER_EXECUTABLE_PATH` si non standard).

## Back

```bash
cd back-bailAutoComplet
cp .env.example .env               # puis compléter (voir VARIABLES.md)
# secrets locaux (à coller dans .env) :
node -e "console.log('EDL_TOKEN_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('EDL_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"

npm run migration:run               # crée les tables (etat_des_lieux, edl_*, onedrive_connexion)
npm run edl:seed                    # facultatif : une entrée signée « Chambre 4 » pour tester une sortie
npm run start:dev                   # API sur http://localhost:8081
```

> ⚠️ **Ne branchez pas un vrai SMTP sur une base qui contient de vraies adresses de locataires** :
> la signature envoie de vrais e-mails. En local, utilisez un compte jetable (Ethereal, Mailtrap) ou un
> « puits » SMTP local, ou laissez `MAIL_HOST` vide (les envois échouent proprement, la signature reste valable).

## Front

```bash
cd bailAutoComplete-Front
nvm use 22 && npm install
npm start                            # http://localhost:4200
```

## Essayer le parcours

1. Se connecter, menu **États des lieux** → choisir un locataire et un type → **Créer** : le lien apparaît (le copier).
2. Ouvrir le lien (idéalement sur un téléphone ou en mode mobile 375 px) : valider, modifier, signer.
3. Menu **OneDrive** : connecter OneDrive pour ranger les photos (voir [ONEDRIVE.md](ONEDRIVE.md)). Sans lui, les photos
   restent « en attente » sur l'appareil et le reste fonctionne.

Tester la **coupure réseau** : outils du navigateur → onglet Réseau → *Hors connexion*, saisir, recharger la page,
rétablir : tout est restauré et synchronisé.

## Tests

| Quoi | Commande | Remarques |
|---|---|---|
| Unitaires back | `npm test` | 1 échec préexistant : `appartement.dto.spec.ts` (champ `couleur`), sans rapport |
| **E2E back** (parcours complet) | `npm run test:e2e` | Postgres + Chrome requis. Crée/efface une base **`bailautocomplet_e2e`** (jamais la base de dev) |
| Front | `npx ng test --watch=false` | Vitest + jsdom |
| Build de prod front | `npx ng build` | Un avertissement de budget (bundle initial) existait déjà |

## Purge RGPD à la main

```bash
npm run edl:retention -- --simulation   # compte les documents échus, ne supprime rien
npm run edl:retention                    # supprime (documents + fichiers OneDrive)
```
