# RGPD — états des lieux numériques

> Ce document décrit ce que **fait** le module. Il ne remplace pas l'avis d'un juriste : les durées et la base
> légale ci-dessous sont des choix raisonnables à **faire valider** (voir « À vérifier »).

## Qui est qui

| Rôle | Qui |
|---|---|
| **Responsable du traitement** | le bailleur (nom et e-mail affichés en tête du formulaire du locataire) |
| **Personnes concernées** | les locataires |
| **Base légale** | exécution du contrat de bail (art. 6.1.b) — l'état des lieux est une obligation attachée au bail |
| **Finalité** | constater l'état du logement à l'entrée et à la sortie, pour la restitution du dépôt de garantie et les litiges éventuels |

## Données traitées

| Donnée | Où | Pourquoi |
|---|---|---|
| Nom, prénom, e-mail, téléphone du locataire | base (fiche existante) ; PDF | identifier les parties, envoyer le PDF |
| État, commentaires, dates de saisie | base (`edl_element`) ; PDF | le constat lui-même |
| **Historique** des modifications (avant/après, auteur, horodatage) | base (`edl_element_historique`) | preuve en cas de litige |
| **Photos** de l'élément | OneDrive du bailleur ; base : identifiant et lien seulement | preuve de l'état |
| **Signature manuscrite** (image) | base ; PDF | consentement / validation |
| Empreinte SHA-256 | base ; PDF | intégrité du document |
| Copie de travail sur l'appareil | IndexedDB du navigateur du locataire | ne rien perdre en cas de coupure |

**Non collecté** : pas de cookie, pas de traceur, pas de compte, pas d'adresse IP conservée par ce module (la limitation de débit ne les garde qu'en mémoire, brièvement), pas de géolocalisation
(les photos sont ré-encodées côté appareil : les métadonnées EXIF, dont la position GPS, sont **effacées**).

## Minimisation

- Consigne affichée près des photos : « Photographiez uniquement l'élément concerné ».
- Aucune donnée personnelle dans les logs de ce module : ni jeton, ni signature, ni commentaire ; adresses e-mail masquées (`l***@exemple.fr`). Un test e2e le vérifie.
- La copie locale (IndexedDB) est **effacée à la signature**.
- Les photos et le PDF ne sont pas stockés par l'application : seulement dans le OneDrive du bailleur.

## Durées de conservation

| Donnée | Durée | Mécanisme |
|---|---|---|
| États des lieux (base) + photos + PDF (OneDrive) | **durée du bail + 3 ans** après la **sortie** du locataire (`EDL_RETENTION_ANNEES`) | purge automatique, voir ci-dessous |
| Liens d'accès | 30 jours (`EDL_TOKEN_TTL_DAYS`), révocables | expiration du jeton |
| Copie locale sur l'appareil | jusqu'à la signature | purge à la signature |
| Un locataire **encore en place** | non purgé | la purge exige une date de sortie |

**Purge** — chaque nuit à 03 h (`@nestjs/schedule`) *et* à la demande :

```bash
npm run edl:retention -- --simulation    # compte, ne supprime rien
npm run edl:retention                     # supprime
POST /rgpd/etats-des-lieux/retention/purger[?simulation=true]   (bailleur connecté)
```

Garde-fous : **100 documents au plus par passage** (une date corrompue ne peut pas tout effacer d'un coup) ;
un document n'est supprimé de la base **qu'après** la suppression de tous ses fichiers OneDrive (sinon les fichiers
deviendraient introuvables) — si OneDrive refuse, le document est **conservé** et réessayé au passage suivant.

> ⚠️ Le conteneur de l'API « s'endort » (scale-to-zero) : la tâche de 03 h n'y est pas garantie. Programmez
> `npm run edl:retention` comme **tâche planifiée de l'hébergeur** (ex. Scaleway Serverless Jobs, cron) une fois par jour.

## Droits des personnes

| Droit | Comment l'exercer (bailleur connecté) |
|---|---|
| **Accès / portabilité** | `GET /rgpd/etats-des-lieux/locataire/:id/export` → fichier JSON (documents, saisies, historique, photos, signature) |
| **Effacement** | `DELETE /rgpd/etats-des-lieux/locataire/:id` → documents, photos et PDF OneDrive supprimés ; réponse : `{documentsSupprimes, fichiersSupprimes, echecs}` |
| **Rectification** | tant que le document n'est pas signé : le bailleur le rouvre (« Rouvrir »). Signé : il est verrouillé par construction ; une rectification passe par un nouvel état des lieux |
| **Opposition / limitation** | à traiter par le bailleur au cas par cas (base légale contractuelle) |

L'effacement porte sur **ce module** (états des lieux). La fiche du locataire, son bail et ses quittances relèvent d'autres parties de l'application.

## Sous-traitants et destinataires

| Qui | Rôle | Données |
|---|---|---|
| **Microsoft** (OneDrive, Graph) | stockage des photos et du PDF, dans le **compte personnel du bailleur** | photos, PDF |
| Hébergeur de l'API (Scaleway) | exécution du service | transit |
| Hébergeur de la base (Render PostgreSQL) | base de données | toutes les données de la base |
| Fournisseur SMTP | acheminement du PDF et du lien | adresse e-mail, PDF en pièce jointe |
| Hébergeur du front (Vercel) | fichiers statiques | aucune donnée personnelle |

Le locataire ne voit jamais Microsoft : les images passent par l'API.

## Mesures de sécurité

HTTPS (`FORCE_HTTPS`) · jeton signé, expirant, révocable · accès OneDrive limité au dossier applicatif (`Files.ReadWrite.AppFolder`) ·
refresh token chiffré en base (AES-256-GCM) · clés et secrets hors dépôt (voir [SECRETS.md](SECRETS.md)) · limitation de débit sur
les routes publiques · validation stricte des entrées et des fichiers · pas de mise en cache des données personnelles ·
en-têtes de sécurité (`helmet`) · CORS restreint · document signé inaltérable + empreinte.

## À vérifier (je ne peux pas le faire à ta place)

- **Durée de 3 ans après la sortie** : s'appuie sur la prescription des actions nées du bail ; à confirmer pour ton cas (litige en cours, dépôt non restitué…).
- **Transferts hors UE** : vérifier la région de ta base (Render) et de ton OneDrive, et les clauses contractuelles des sous-traitants.
- **Registre des traitements** : ajouter une ligne « états des lieux numériques » (finalité, base légale, durées, sous-traitants — le tableau ci-dessus).
- **Mention d'information** : le texte court en tête du formulaire (responsable, finalité, durée, contact) est affiché ; une page « politique de confidentialité » complète reste à rédiger si tu le souhaites.
- **Signature électronique** : l'empreinte prouve l'intégrité, mais ce n'est **pas** une signature qualifiée (eIDAS). Suffisant en pratique pour un état des lieux entre particuliers, à ta discrétion.
