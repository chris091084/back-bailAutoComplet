# État des lieux numérique — décisions prises

Journal des choix faits sans te consulter (consigne : « décide par défaut, signale-moi »).
Chaque ligne dit **ce qui a été choisi**, **pourquoi**, et **comment le changer**.

## Contexte repéré dans le projet

| Sujet | Constat |
|---|---|
| Back | NestJS 11, TypeORM 0.3, PostgreSQL, **migrations SQL écrites à la main**, Jest |
| Front | Angular 22 (composants *standalone*, c.-à-d. sans NgModule), Bootstrap 5, Vitest |
| Auth bailleur | JWT en cookies httpOnly, guard **global** fermé par défaut (`@Public()` pour ouvrir une route) |
| Mail | `MailService` (nodemailer/SMTP) déjà en place |
| Hébergement | Back sur Scaleway Serverless Containers (*scale-to-zero* : l'instance s'endort), PostgreSQL |
| Dépôts | Deux dépôts git séparés (back et front). Pas de dépôt racine |

## Phase 1 — Socle

| # | Décision | Pourquoi / comment changer |
|---|---|---|
| 1 | Docs dans `back-bailAutoComplet/docs/etat-des-lieux/` | Pas de dépôt racine ; les docs existantes (`doc-*.md`) sont déjà côté back |
| 2 | Entités préfixées `Edl` (`EdlPiece`, `EdlElement`, `EdlPhoto`, `EdlElementHistorique`) ; tables `edl_*` | « Piece », « Element » seuls sont trop vagues (il existe déjà `Chambre.piece`) |
| 3 | Identifiants **UUID** pour les 5 nouvelles tables ; clés vers `appartement` / `locataire` restent `bigint` | Le lien ne doit rien laisser deviner ; ces deux tables existantes sont en `bigint` |
| 4 | `logementId` = `appartement_id`, `locataireId` = `locataire_id` | Le projet dit « appartement » |
| 5 | Routes bailleur et locataire **partagent** le préfixe `/etats-des-lieux`. Routes bailleur en plus : `GET /` (liste), `GET /:id/detail`, `POST /:id/lien` | Respecte tes chemins `:token`. Pas de collision : le 2ᵉ segment des routes bailleur est fixe |
| 6 | Jeton = JWT signé avec **`EDL_TOKEN_SECRET`** (≠ clés de session), audience `edl-locataire`, `sub` = id du document, `jti` = version du lien | Un lien ne peut jamais valoir une session. `jti` stocké en base : **régénérer** le lien révoque l'ancien |
| 7 | Durée du lien : **30 jours** (`EDL_TOKEN_TTL_DAYS`) | Assez pour remplir, pas indéfini |
| 8 | Clé `EDL_TOKEN_SECRET` lue **à l'usage**, avertissement au démarrage si absente | Ne bloque pas le démarrage du reste de l'API |
| 9 | **Conflit** = le serveur refuse (409) si son `dateModifLocataire` est **strictement plus récent** que l'horodatage envoyé. Égal = rejeu → accepté sans rien réécrire (idempotence). Le 409 renvoie l'élément du serveur | Résolution « le plus récent gagne » demandée ; le client s'aligne sans 2ᵉ appel |
| 10 | Horodatage client plafonné à *heure serveur + 5 min* | Un téléphone mal réglé ne « verrouille » pas un élément dans le futur |
| 11 | Valider (`valide`) exige un état connu : celui du locataire, sinon celui du bailleur | Empêche de valider du vide en entrée (sans référence) |
| 12 | Une modification confirmée **valide** l'élément (le front enverra `statutValidation: valide`) | « Confirmer la modification » = élément traité |
| 13 | Une fois le statut `validated`, les éléments sont **verrouillés** (409 `NON_MODIFIABLE`) ; seul le bailleur pourra rouvrir (phase 5) | Réponse « non » à ta question sur le commentaire après validation globale |
| 14 | Pour une **sortie**, la « référence bailleur » = valeur **retenue à l'entrée** (saisie du locataire si elle existe, sinon celle du bailleur) | Ce que les deux parties ont signé |
| 15 | Entrée de référence = la dernière entrée **signée** du locataire (ou `etatEntreeRefId` explicite) ; rapprochement par nom de pièce + d'élément (sans accents ni casse) | Pas de saisie manuelle des liens |
| 16 | Modèle par défaut d'une entrée : une pièce « Chambre » (Murs, Sols, Plafond, Fenêtres, Électricité, Bureau), éditable dans `modele-par-defaut.ts` | Je n'ai pas ton Word : **envoie-le-moi** pour aligner les pièces et la mise en page du PDF |
| 17 | Infos générales **figées** à la création (adresse, chauffage, clés) | Un document signé ne doit pas bouger si on modifie la fiche logement |
| 18 | Historique : table `edl_element_historique` (avant/après en JSON, auteur, horodatage client + serveur), une ligne par modification **réelle** | Preuve en cas de litige |
| 19 | Max **5 photos** par élément, visionneuse plein écran | Défaut demandé (phase 4) |
| 20 | **PATCH** ajouté aux méthodes CORS (`app.setup.ts`) | Absent, le navigateur aurait bloqué toutes les sauvegardes |
| 21 | Seed : `npm run edl:seed [-- --locataire=ID]` crée une entrée **signée** « Chambre 4 » pour le dernier locataire | Sans effet si une entrée signée existe déjà |
| 22 | Tests e2e sur une base **dédiée** `bailautocomplet_e2e` (recréée à chaque lancement, refus si c'est la base de dev) | Réutilise le Postgres de dev ; vérifie aussi que les migrations s'enchaînent depuis zéro |

## Phase 2 — UI principale

| # | Décision | Pourquoi / comment changer |
|---|---|---|
| 23 | Page publique `/edl/:token`, **sans** barre de navigation du bailleur ni attente du réveil du backend | La page gère elle-même le serveur endormi et doit s'ouvrir hors ligne : la sonde de démarrage l'aurait bloquée sur le splash |
| 24 | Requêtes locataire marquées `PUBLIC_REQUEST` : l'intercepteur ne leur applique ni cookie, ni refresh, ni redirection `/login` | Un lien expiré n'a rien à voir avec une session expirée |
| 25 | Store fourni **par la page** (pas `root`), `signals` + `inject`, composants *standalone*, `@if/@for` | Style des composants récents du projet ; un lien = un état vierge |
| 26 | Couleurs en variables CSS `--edl-*` (`edl-theme.scss`, importé dans `styles.scss`) | Pas de couleur en dur dans les composants |
| 27 | Pré-sélection des puces = état du locataire, sinon celui du bailleur ; le commentaire part de la saisie du **locataire** seulement | Ne pas recopier le commentaire du bailleur comme s'il venait du locataire |
| 28 | Coche rapide désactivée sans état connu (entrée sans référence) | Il n'y a alors rien à « accepter » : le locataire passe par « Modifier » |
| 29 | Icônes en SVG intégré (pas de police d'icônes) | La police Bootstrap Icons vient d'un CDN, absente hors ligne |
| 30 | Mention RGPD en tête : « durée du bail puis 3 ans » écrite en dur | À brancher sur la durée configurable en phase 6 |

## Phase 3 — Hors-ligne léger

| # | Décision | Pourquoi / comment changer |
|---|---|---|
| 31 | Écran = **base** (dernière version serveur ou restaurée) **+ saisies en attente** ; une seule saisie en attente par élément, fusionnée champ par champ | Évite de rejouer dix étapes intermédiaires ; l'horodatage envoyé est celui de la dernière saisie |
| 32 | Clé de stockage local = `sub` du jeton (décodé sans vérification) | Ce n'est qu'une clé de rangement ; le serveur vérifie le jeton à chaque appel. Un **nouveau lien** du même document retrouve donc les saisies en attente |
| 33 | Ouverture : copie locale affichée **tout de suite**, puis rafraîchie depuis le serveur (« stale-while-revalidate ») | Restauration sans action de l'utilisateur, et page utile pendant le réveil du serveur |
| 34 | Fusion au chargement : une saisie locale **strictement plus ancienne** que le serveur est abandonnée (avis affiché) ; à égalité, rejeu | Règle « le plus récent gagne » |
| 35 | Relances : à chaque saisie, à l'événement `online`, et minuteur de secours **15 s → 22,5 s → 30 s** (plafond). `Retry-After` respecté jusqu'à 2 min | Spécification 15–30 s avec backoff |
| 36 | Erreurs définitives (409 conflit/verrou, 4xx) : saisie **abandonnée** et signalée ; 401 (lien) : **bloque** la file mais garde tout sur l'appareil | Ne pas rejouer à l'infini ce qui sera toujours refusé |
| 37 | « Signer » exige : tout traité **+** rien en attente **+** serveur confirmé (`source = serveur`) **+** lien valide | On ne signe pas sur une copie locale |
| 38 | Si IndexedDB est inutilisable : repli en mémoire + avertissement « restez sur la page » | Navigation privée |
| 39 | Dépendances : `idb` (+ `fake-indexeddb` en test seulement) | Demandé ; simulateur d'IndexedDB pour Jest/Vitest |

## Phase 4 — Photos

| # | Décision | Pourquoi / comment changer |
|---|---|---|
| 40 | Le serveur n'enregistre une photo **qu'après** l'avoir déposée sur OneDrive ; `statut_sync` y vaut donc toujours `synced`. L'état « en attente » vit **sur l'appareil**, qui garde le Blob | Le serveur n'a pas de disque durable (Scaleway) : le téléphone est le tampon. Aucune photo perdue |
| 41 | Réponse **503** (+ `Retry-After`) quand OneDrive est non connecté, révoqué, plein, limité (429) ou en panne ; code `ONEDRIVE_*` | Le client traite 503 comme « à réessayer » |
| 42 | Photo reconnue par ses **premiers octets** (JPEG/PNG/WebP), pas par le type MIME annoncé ; 8 Mo max | Un type MIME est falsifiable |
| 43 | Identifiant de photo **choisi par le client** (UUID) : un envoi rejoué ne crée ni doublon ni second fichier | Idempotence |
| 44 | Compression côté client : 1600 px, JPEG 0,8, **rotation EXIF appliquée**, métadonnées (GPS…) **effacées** par ré-encodage | Minimisation des données |
| 45 | Photos locales gardées (statut `envoyee`) jusqu'à la signature, puis **purgées** de l'appareil | Vignettes rapides/hors ligne ; pas de données qui traînent |
| 46 | Suppression d'une photo déjà envoyée : « pierre tombale » rejouée hors ligne ; fichier OneDrive supprimé **avant** la ligne en base | Si OneDrive est en panne, la ligne reste et la suppression sera rejouée |
| 47 | Pas de SDK Azure/MSAL : `fetch` natif de Node 20 | Trois appels REST suffisent ; zéro dépendance |
| 48 | `state` OAuth = JWT signé 10 min, clé **dérivée** (HMAC) de `EDL_ENCRYPTION_KEY` | Anti-CSRF sans session (le cookie `SameSite=strict` n'est pas envoyé au retour de Microsoft) ; une clé = un usage |
| 49 | Scopes : `Files.ReadWrite.AppFolder offline_access` uniquement | Demandé ; `.All` jamais |
| 50 | **Limite connue** : le flux OAuth réel n'a pu être testé qu'avec un Microsoft simulé (pas d'identifiants Azure ici) | La 1re connexion réelle est à faire par toi (voir `ONEDRIVE.md`) |

## Phase 5 — Validation, signature, PDF, e-mail

| # | Décision | Pourquoi / comment changer |
|---|---|---|
| 51 | `sign` accepte un document `draft` ou `validated` et **revérifie** que tout est traité ; `validate` reste un pas explicite et idempotent | Le front appelle les deux ; un appel direct à `sign` ne contourne rien |
| 52 | La signature est **une transaction courte** (verrou, signatures, date, statut, empreinte). PDF, archive et e-mails viennent **après** et peuvent échouer sans l'annuler ; la réponse dit ce qui a marché | Signature acquise = jamais remise en cause par une panne de SMTP/Chromium/OneDrive. `POST /:id/renvoyer` rattrape |
| 53 | PDF et e-mails sont faits **avant** de répondre (pas en tâche de fond) | Le conteneur « scale-to-zero » peut geler son CPU dès la réponse envoyée |
| 54 | `puppeteer-core` + Chromium **du système** (installé dans l'image Docker, `/usr/bin/chromium`) | Demandé ; `puppeteer-core` ne télécharge aucun navigateur. **Coût** : image ~300 Mo plus lourde, prévoir ≥ 1 Go de mémoire |
| 55 | Un seul PDF à la fois ; navigateur lancé puis fermé à chaque document ; réseau coupé dans le navigateur (tout est en URL de données) ; photos réduites à 480 px dans le PDF | Mémoire du conteneur ; PDF de ~100 Ko au lieu de dizaines de Mo ; contenu injecté sans accès à l'extérieur |
| 56 | Tout texte utilisateur est **échappé** dans le gabarit HTML ; `src` d'image limité à nos URL de données | Un commentaire `<script>` ne s'exécute pas dans Chromium (testé) |
| 57 | Une photo introuvable à l'impression ne fait pas échouer le PDF : « Photo non récupérable » | Un fichier supprimé à la main dans OneDrive ne doit pas bloquer un document signé |
| 58 | **Empreinte SHA-256** du contenu calculée à la signature, imprimée sur le PDF | Preuve d'intégrité en cas de litige. Ce n'est **pas** une signature qualifiée eIDAS |
| 59 | Le PDF est envoyé au locataire (s'il a un e-mail) et au bailleur, avec la copie cachée `MAIL_BCC` d'archivage habituelle. Le **lien**, lui, part **sans** copie cachée | Le lien est un secret (même règle que le lien de connexion) |
| 60 | Pour le bailleur, en plus de ta liste : page **États des lieux** (créer, copier/envoyer le lien, suivre, rouvrir, PDF), `POST /:id/envoyer-lien`, `POST /:id/reouvrir`, `POST /:id/renvoyer` | Sans interface, il aurait fallu des appels `curl` pour créer un document. À retirer si tu préfères autre chose |
| 61 | `/sign` : 5 appels/min/IP, corps jusqu'à 650 Ko (le reste de l'API reste à 100 Ko) ; signature = vrai PNG ≤ 200 Ko | Deux signatures en base64 dépassent 100 Ko |
| 62 | Après la signature, la copie locale (document, saisies, photos) est **purgée de l'appareil** | Minimisation |

## Phase 6 — RGPD, rétention, durcissement

| # | Décision | Pourquoi / comment changer |
|---|---|---|
| 63 | Échéance = **date de sortie du locataire + 3 ans** (`EDL_RETENTION_ANNEES`) ; un locataire encore en place n'est jamais purgé | « Durée du bail + 3 ans » |
| 64 | Les documents échus sont **supprimés** (pas anonymisés), photos et PDF OneDrive compris | Une anonymisation de photos n'aurait pas de sens ; le constat n'a plus d'utilité après la prescription |
| 65 | Document supprimé de la base **seulement après** ses fichiers OneDrive ; si OneDrive refuse → conservé et réessayé | Sinon les identifiants seraient perdus et les fichiers resteraient à jamais |
| 66 | Garde-fou : **100 documents max par passage** | Une date corrompue ne peut pas tout effacer |
| 67 | Purge : tâche de 03 h **et** `npm run edl:retention [-- --simulation]` **et** `POST /rgpd/…/retention/purger` | Le conteneur dort la nuit : la tâche interne n'y est pas garantie → à brancher sur une tâche planifiée de l'hébergeur |
| 68 | `@nestjs/schedule` en **v6** (pas la v12) | La v12 est en ESM pur, incompatible avec ce back en CommonJS/Jest |
| 69 | Export (JSON) et effacement d'un locataire : `GET/DELETE /rgpd/etats-des-lieux/locataire/:id…` ; portée = **ce module** | La fiche et le bail relèvent d'autres modules |
| 70 | `Cache-Control: no-store` sur `/etats-des-lieux`, `/rgpd`, `/onedrive` (sauf images : `private`) ; `FORCE_HTTPS` → 308 ; `<meta referrer=no-referrer>` | Données personnelles non cachées ; le jeton ne fuit pas par `Referer` |
| 71 | `MailService` (existant) **masque** désormais l'adresse dans ses logs (`l***@domaine`) | Donnée personnelle inutile dans un log conservé par l'hébergeur |
| 72 | Secrets : variables d'environnement secrètes de l'hébergeur (aucun coffre dédié dans le projet) | Le plus simple, zéro code. Infisical/Doppler restent branchables (voir `SECRETS.md`) |
| 73 | Tests de garde : `.env.example` sans valeur secrète ; **scan des logs** d'un parcours complet (aucun jeton, signature, commentaire, e-mail, secret) | Les engagements « aucun secret / aucune donnée dans les logs » sont **vérifiés**, pas seulement promis |

## À toi de trancher plus tard (non bloquant)

- **Word d'origine** : non trouvé dans le dépôt (seuls bail/quittance/résiliation y sont). Utile pour les pièces par défaut et le PDF.
- **Gestionnaire de secrets** : voir décision 72 et `SECRETS.md`.
- **Tâche de purge** : à programmer chez l'hébergeur (décision 67).
- **Politique de confidentialité complète** : seule la mention courte est affichée (voir `RGPD.md`, « À vérifier »).
