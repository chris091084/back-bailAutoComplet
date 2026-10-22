# Registre des activités de traitement (RGPD, article 30)

> Document vivant : à relire et à mettre à jour à chaque évolution qui touche
> aux données personnelles (nouveau champ, nouveau prestataire, nouvelle
> fonctionnalité). Il doit pouvoir être présenté à la CNIL sur demande.
>
> **Version 1.10 — 21/10/2026.** Brouillon établi à partir du code. Les points
> marqués ⚠️ **À CONFIRMER** demandent une décision ou une vérification humaine.
> Ce document n'est pas un avis juridique.

## 1. Responsable de traitement

| Élément | Valeur |
|---|---|
| Responsable de traitement | ⚠️ **À CONFIRMER** : la SCI (bailleur du seed `SeedBailleurSci`) ou le propriétaire en personne. Indice : l'organisation Scaleway s'appelle « SCI BZHRO » |
| Adresse | ⚠️ À renseigner |
| Contact pour les questions RGPD | `sylvain.bodin@gmail.com` (adresse indiquée aux locataires, voir l'annexe A). Boîte Gmail : voir la section 6 bis pour le nettoyage des échanges |
| DPO (délégué à la protection des données) | Non désigné (non obligatoire pour cette activité) |

## 2. Vue d'ensemble des flux

```
Propriétaire ──► Front Angular (Vercel)
                      │
                      ▼
                API NestJS (Scaleway) ──► BDD PostgreSQL 16 (Scaleway Serverless SQL, Paris)
                      │
                      ├──► LibreOffice (dans le conteneur de l'API) : .docx → PDF
                      │
                      └──► SMTP (Gmail) ──► e-mail du locataire (+ copie cachée MAIL_BCC)
```

Les documents (bail, congé) sont générés à la demande et convertis **dans le
conteneur de l'API** : ils ne sont pas stockés en base et ne transitent par
aucun service tiers de conversion.

## 3. Traitements

### T1 — Gestion des locataires et des logements

| Mention | Contenu |
|---|---|
| Finalité | Suivre les locataires d'un logement (entrée, sortie, coordonnées) pour gérer la location |
| Personnes concernées | Locataires et anciens locataires |
| Données | Nom, prénom, téléphone, e-mail, date de naissance, profession, dates d'entrée et de sortie, état (en place / sorti), dates d'envoi du bail et de la résiliation |
| Données sensibles (art. 9) | Aucune |
| Base légale | Exécution du contrat de bail (art. 6.1.b) |
| Destinataires | Le propriétaire (seul utilisateur de l'application) ; hébergeur de la base (Scaleway) |
| Transferts hors UE | Non : base Scaleway en région PAR (Paris), confirmé sur la console |
| Durée de conservation | **3 ans après la sortie** (prescription des actions nées du bail : art. 7-1 de la loi 89-462 du 6 juillet 1989, rendu applicable aux meublés en résidence principale par l'art. 25-3 et au bail mobilité par l'art. 25-12, vérifié sur Légifrance le 20/10/2026 ; couvre les trois types de bail de l'application : mobilité, étudiant, durée indéterminée). **Exception** : le propriétaire peut exclure un locataire sorti de la purge (litige en cours, obligation de conservation plus longue) avec le commutateur « Ne pas supprimer » de l'onglet Locataires sortis, puis suppression de la fiche, du bail (`result_form`) et de l'historique de génération (`generation`) : voir E1. ⚠️ **À CONFIRMER** : les obligations comptables et fiscales peuvent justifier plus long pour certaines pièces (quittances, justificatifs de revenus fonciers) ; elles ne sont pas stockées par l'application |
| Sécurité | Accès par authentification forte (T3), connexion chiffrée (HTTPS), base accessible en SSL avec vérification du certificat (E7, à activer en production), rôle unique côté application. **Colonnes personnelles chiffrées** (AES-256-GCM, clé hors base, voir E12) : nom, prénom, téléphone, e-mail, date de naissance, profession, et dans le bail nom, prénom, e-mail, téléphone, adresse, motif. Restent en clair : état, dates d'entrée et de sortie, dates et montants du bail, chambre |

### T2 — Génération et envoi des documents (bail, congé)

| Mention | Contenu |
|---|---|
| Finalité | Produire le bail et la lettre de congé, et envoyer le courrier au locataire par e-mail avec pièce jointe |
| Personnes concernées | Locataires |
| Données | Identité, adresse du logement, chambre, loyer et charges, indice IRL appliqué, motif du congé, e-mail du locataire ; copie des mêmes données dans la pièce jointe |
| Données sensibles | Aucune. Le champ « motif » est libre : éviter d'y saisir des informations de santé ou de situation personnelle |
| Base légale | Exécution du contrat (art. 6.1.b) et obligation légale de notifier le congé |
| Destinataires | Le locataire ; le fournisseur SMTP (Google, via Gmail) ; l'adresse en copie cachée `MAIL_BCC` (archivage des courriers expédiés, voir E8) |
| Transferts hors UE | Possible : le fournisseur d'envoi est **Google (Gmail)**, qui peut traiter les données hors de l'Union européenne (États-Unis). Encadrement attendu : certification *Data Privacy Framework* de Google, ⚠️ **à vérifier** avant de l'affirmer. Aucun contrat de sous-traitance signé (compte Gmail gratuit : conditions d'utilisation de Google) |
| Durée de conservation | Données en base : voir T1. **Courriers envoyés** : ils restent dans la boîte Gmail (dossier Envoyés et copie `MAIL_BCC`), **sans suppression automatique** (décision du 21/10/2026). Règle : supprimer les échanges d'un locataire au plus tard 3 ans après sa sortie ; un mail de rappel part après chaque purge (voir E1 et la section 6 bis) |
| Sécurité | SMTP en TLS, mot de passe d'application (pas le mot de passe du compte), documents non stockés côté API. Les données du bail en base sont chiffrées (E12) ; **les courriers eux-mêmes, dans Gmail, ne le sont pas** |

### T3 — Authentification du propriétaire

| Mention | Contenu |
|---|---|
| Finalité | Réserver l'accès à l'application au propriétaire et sécuriser les sessions |
| Personnes concernées | Le propriétaire (compte unique, plusieurs adresses autorisées possibles) |
| Données | Hash bcrypt du mot de passe, passkeys (clé publique, identifiant, compteur, libellé, dates d'usage), hash du lien magique et son expiration, hash du jeton de rafraîchissement, adresses e-mail autorisées (variable d'environnement `AUTH_OWNER_EMAIL`) |
| Données sensibles | Aucune (aucune donnée biométrique stockée : seul le navigateur ou le système la manipule) |
| Base légale | Intérêt légitime : sécurité du système (art. 6.1.f) |
| Destinataires | Hébergeur de la base ; fournisseur SMTP (Google) pour le lien magique (ce mail n'est jamais mis en copie cachée) |
| Transferts hors UE | Voir T2 pour le SMTP |
| Durée de conservation | Jetons : 15 minutes (accès) et 7 jours (rafraîchissement). Passkeys : jusqu'à suppression par le propriétaire (`npm run auth:reset-passkeys`) |
| Sécurité | Cookies `httpOnly`, `Secure` en production, `SameSite=strict` ; seuls les hash sont stockés ; limitation des tentatives |
| Cookies | Uniquement des cookies strictement nécessaires au fonctionnement (session) : pas de consentement requis, pas de traceur publicitaire ou statistique |

### T4 — Sécurité technique et journaux

| Mention | Contenu |
|---|---|
| Finalité | Bloquer les attaques par force brute et diagnostiquer les erreurs |
| Personnes concernées | Toute personne qui tente de se connecter (propriétaire ou tiers) |
| Données | Adresse IP et horodatage des échecs de connexion (table `login_failure`) ; journaux applicatifs de l'API (voir les écarts ci-dessous) |
| Base légale | Intérêt légitime : sécurité (art. 6.1.f) |
| Destinataires | Le propriétaire ; hébergeur de l'API (Scaleway) pour les journaux |
| Transferts hors UE | Non : conteneur Scaleway en région PAR (Paris), vérifié sur la console |
| Durée de conservation | Échecs de connexion : fenêtre de 15 minutes pour le blocage, mais ⚠️ **les lignes ne sont pas purgées** (voir écarts). Journaux : ⚠️ durée de rétention Scaleway à vérifier |
| Sécurité | Accès aux journaux limité au compte d'hébergement |

## 4. Sous-traitants

Un **sous-traitant** est un prestataire qui traite des données pour le compte du
responsable de traitement. Un contrat (ou des conditions générales qui
l'intègrent, le DPA) doit encadrer chacun.

| Prestataire | Rôle | Données concernées | Localisation | DPA signé ? |
|---|---|---|---|---|
| Vercel | Hébergement du front | Aucune donnée locataire stockée (le front ne fait que relayer) ; adresses IP des visiteurs | Servi depuis Paris (nœud CDG) lors d'un test ; région d'hébergement à vérifier | ⚠️ À vérifier |
| Scaleway | Hébergement de l'API (conteneur serverless) | Toutes les données en transit ; journaux | Paris (PAR), France : confirmé | ⚠️ À vérifier |
| Scaleway | Base PostgreSQL 16 (Serverless SQL Database `bailautocomplete-db`) | Toutes les données de T1 à T4 | Paris (PAR), France : confirmé sur la console. Sauvegardes automatiques (7 visibles dans l'onglet Backups) : ⚠️ durée de conservation à vérifier | ⚠️ À vérifier |
| Google (Gmail) | Envoi des e-mails ; boîte qui reçoit la copie cachée et les rappels | E-mail, identité, pièce jointe | États-Unis possible (voir T2) ; *Data Privacy Framework* ⚠️ à vérifier | Pas de contrat signé (compte gratuit) : conditions d'utilisation de Google |
| Render | **Supprimé le 21/10/2026** (base et compte, par le propriétaire) : ancienne base PostgreSQL, citée dans `doc-deploiement-backend.md` | Plus aucune donnée chez ce prestataire | — | Sans objet |
| Koyeb | **Compte supprimé le 21/10/2026** (par le propriétaire) : ancien hébergement du backend, cité dans les schémas des docs de déploiement | Plus aucune donnée chez ce prestataire | — | Sans objet. Reste à corriger les schémas et l'URL Koyeb des docs de déploiement |

Non concerné : l'API INSEE de l'IRL (indice public, aucune donnée personnelle
n'est envoyée).

## 5. Écarts constatés dans le code (à traiter)

| # | Constat | Pourquoi c'est un sujet | Piste |
|---|---|---|---|
| E1 | Aucune purge des locataires : la « sortie » remplace la suppression, les fiches sortis restent indéfiniment | Principe de **limitation de la conservation** (art. 5.1.e) | 🔧 Purge ajoutée (v1.4) : `npm run purge:locataires` (essai à blanc) puis `-- --execute`, et automatique au démarrage de l'API avec `PURGE_LOCATAIRES=true` (désactivée par défaut). **À activer** en production après un essai à blanc. Les **candidats** (bail généré, jamais signé) n'ont pas de date de sortie : le délai ne court pas pour eux, ils se suppriment **à la main** depuis l'écran Locataires, onglet Candidats, bouton « Supprimer » (v1.5), qui efface la fiche, le bail et l'historique de génération. ⚠️ Le propriétaire doit penser à les supprimer quand une candidature n'aboutit pas. Après chaque purge automatique, un **mail de rappel** part aux adresses de `AUTH_OWNER_EMAIL` (sans copie cachée), avec la liste des anciens locataires et leurs adresses : le propriétaire supprime alors à la main leurs échanges (mails, SMS, papiers). Le message contient ces adresses et se retrouve dans la recherche : il se supprime avec le reste. Reste hors périmètre : les saisies de bail jamais générées (« brouillons »), supprimables depuis le formulaire de bail |
| E2 | Table `login_failure` sans purge | Adresses IP gardées sans limite | Supprimer les lignes de plus de X jours (planifié ou à l'écriture) |
| E3 | ✅ **Corrigé (v1.1).** `mail.service.ts` journalisait « Mail envoyé à *adresse* » | L'e-mail du locataire se retrouvait dans les journaux, avec leur propre rétention | Les logs portent désormais l'identifiant du message, plus l'adresse. Restent à vérifier : la rétention Scaleway, et le fait que la pile d'une erreur SMTP peut citer une adresse |
| E4 | Champ libre `motif` du congé | Risque de saisir des données sensibles | Consigne d'usage, ou liste de motifs prédéfinis |
| E5 | ✅ **Traité (v1.9).** Pas de procédure pour les droits des personnes | Accès, rectification, effacement, à traiter sous 1 mois | Procédure et contact en section 6, lieux d'effacement en section 6 bis |
| E6 | Pas de mention d'information remise aux locataires | Obligation d'informer (art. 13) | 🔧 Texte rédigé (annexe A, v1.9). **À joindre au bail** après avoir levé les points entre crochets (responsable de traitement) |
| E7 | 🔧 **Code prêt (v1.1), à activer.** La connexion à la base chiffrait mais ne vérifiait pas le certificat (`rejectUnauthorized: false`) | Un intermédiaire pourrait se faire passer pour la base (art. 32) | Renseigner `DB_SSL_CA` (certificat de l'autorité) ou `DB_SSL_VERIFY=true` chez l'hébergeur de l'API. Sans l'un des deux, un avertissement est journalisé au démarrage |
| E8 | La copie cachée `MAIL_BCC` duplique chaque bail PDF (données complètes du locataire) dans une boîte personnelle | C'est un traitement à part entière : finalité d'archivage, durée et sécurité de cette boîte à définir | Voir T2 : confirmer la finalité (la base conserve déjà les dates d'envoi, la copie est-elle encore utile ?), la durée de conservation (règle de nettoyage : section 6 bis), et protéger la boîte (mot de passe fort, double authentification) |
| E9 | ✅ **Traité.** Option « HTTPS connections only » : **activée** sur le conteneur Scaleway (constat sur la console le 21/10/2026). Elle était signalée désactivée le 20/10 | L'API répond aussi en HTTP non chiffré : un mot de passe, un cookie ou un bail pourrait circuler en clair si un client appelle l'adresse en `http://` (art. 32) | Aucune action : option active, à recontrôler après toute modification du conteneur |
| E10 | Le front Vercel n'envoyait aucun en-tête de sécurité (anti-affichage dans un cadre, anti-détournement de type de fichier) | Défense en profondeur (art. 32) | 🔧 `vercel.json` ajouté (v1.3), effectif au prochain déploiement. Une politique CSP plus stricte reste possible, à tester avec le login par passkey |
| E11 | L'accès de l'application à la base repose sur une **clé API IAM** (utilisateur = identifiant de l'application IAM, mot de passe = clé secrète) qui **expire au bout d'un an maximum** | Une clé expirée coupe l'accès à la base ; une clé visible en clair ou stockée comme variable normale est exposée à quiconque ouvre la console (art. 32) | Stocker `DATABASE_URL` comme **variable secrète** chez Scaleway, remplacer la clé avant son expiration (rappel à poser dans l'agenda), ne jamais saisir une clé dans une commande ni la coller dans un échange |
| E12 | Les données personnelles étaient stockées **en clair** dans la base : un dump, une sauvegarde, un accès à la base ou une capture de l'extension SQL les rendait lisibles | Mesure de sécurité adaptée au risque (art. 32) | 🔧 **Code prêt (v1.10), à déployer** : chiffrement par colonne (`ENCRYPTION_KEY`, AES-256-GCM, IV aléatoire), script de reprise de l'existant `npm run chiffrer:donnees`, changement de clé possible (`ENCRYPTION_KEY_PREVIOUS`). Limites : la clé est dans le même conteneur que l'accès à la base (protège d'une fuite de la base ou d'un dump, pas d'une prise de contrôle de l'application ou de la console) ; **perdre la clé, c'est perdre ces données** (la garder dans un gestionnaire de mots de passe, hors git et hors dump) ; les colonnes chiffrées ne se lisent plus avec un outil SQL ; données du bailleur volontairement non chiffrées. Procédure de mise en production : `doc-deploiement-backend.md` |

## 6. Droits des personnes (procédure minimale)

Le locataire peut demander l'accès à ses données, leur rectification, leur
effacement (dans les limites des obligations légales de conservation), la
limitation ou l'opposition au traitement.

```
Demande reçue ──► vérifier l'identité ──► repérer la fiche (table locataire + result_form)
      │                                          │
      └─ réponse sous 1 mois ◄── export / correction / suppression
```

Contact : `sylvain.bodin@gmail.com` (voir la section 1 et l'annexe A).

Le propriétaire n'est pas tenu d'effacer à chaque demande : il doit **répondre sous
1 mois**, soit en effaçant, soit en refusant pour un motif légitime (obligation
légale de conserver, défense de ses droits pendant les 3 ans), en l'expliquant et
en indiquant le recours auprès de la CNIL. Aucune route ne permet à un tiers
d'effacer lui-même des données : c'est voulu.

| Demandeur | Réponse | Comment |
|---|---|---|
| **Candidat** (bail non signé) | Effacer | Onglet Candidats, bouton « Supprimer », puis les échanges (section 6 bis) |
| **Locataire en place** | Refuser l'effacement (contrat en cours) ; rectification possible | Modale d'édition de la fiche |
| **Sorti depuis moins de 3 ans** | En principe refuser (défense en cas de litige), en motivant | Aucune route : une suppression exceptionnelle passerait par une intervention manuelle en base |
| **Sorti depuis plus de 3 ans** | Déjà purgé, sauf commutateur « Ne pas supprimer » | Purge automatique ou `npm run purge:locataires -- --execute` |

## 6 bis. Où se trouvent les données et comment les effacer

Une demande d'effacement, ou la fin des 3 ans, vaut pour **tous** les endroits où
se trouvent des données du locataire, pas seulement la base.

| Endroit | Contenu | Comment effacer |
|---|---|---|
| Base Scaleway | Fiche, bail (`result_form`), historique de génération | Bouton « Supprimer » (candidat) ou purge des sortis |
| **Boîte Gmail** | Courriers envoyés par l'application (« Votre projet de bail », « Courrier de demande de résiliation du bail », « Quittance(s) de loyer »), copie `MAIL_BCC`, réponses et autres échanges | **À la main** : chercher l'adresse du locataire, tout sélectionner, supprimer, vider la Corbeille (Gmail la garde environ 30 jours). Le mail de rappel envoyé après chaque purge donne les adresses à chercher et se supprime avec le reste |
| Sauvegardes Scaleway de la base | Copie complète, y compris des données déjà effacées. Celles **faites avant le chiffrement contiennent les données en clair** jusqu'à leur expiration ; les suivantes contiennent du texte chiffré | Elles expirent d'elles-mêmes : ⚠️ durée à vérifier et à noter ici |
| Fichiers de sauvegarde manuels (`.sql`) et bases de test copiées de la production | Données de tous les locataires : **en clair pour ceux faits avant le chiffrement**, chiffrées ensuite (illisibles sans `ENCRYPTION_KEY`) | Supprimer les anciens dès le chiffrement en production ; les nouveaux, après usage. Ne jamais ranger la clé au même endroit qu'un dump |
| SMS, WhatsApp, contacts du téléphone, papiers (bail signé, états des lieux) | Échanges et pièces | À la main, au même moment |
| Journaux Scaleway | Identifiants de messages, pas d'adresse (E3) | Rétention ⚠️ à vérifier |

Aucun nettoyage automatique des e-mails n'est prévu (décision du 21/10/2026) : ce
choix évite de donner à l'application un accès en suppression à la boîte Gmail.

## 7. Violation de données

En cas de perte, fuite ou accès non autorisé (par exemple fuite du `.env`,
base exposée) : noter l'incident (date, nature, données touchées, mesures), et
le **notifier à la CNIL sous 72 heures** s'il présente un risque pour les
personnes. Conserver une trace même si la notification n'est pas nécessaire.

## 8. Journal des modifications

| Date | Version | Modification |
|---|---|---|
| 20/10/2026 | 1.0 | Création du registre à partir de l'analyse du code |
| 20/10/2026 | 1.1 | E3 corrigé (plus d'adresse dans les logs) ; E7 ajouté (vérification du certificat de la base, code prêt) ; E8 ajouté (copie cachée `MAIL_BCC`) |
| 20/10/2026 | 1.2 | Scaleway : région Paris confirmée ; E9 ajouté (HTTPS non imposé) |
| 20/10/2026 | 1.3 | Front vérifié (HTTPS + HSTS OK) ; E10 ajouté (`vercel.json` d'en-têtes de sécurité) ; Koyeb probablement abandonné |
| 20/10/2026 | 1.4 | E1 traité : durée de conservation fixée à 3 ans après la sortie, purge des locataires sortis (code et script) |
| 20/10/2026 | 1.5 | Suppression manuelle d'un candidat (route `DELETE /locataire/:id` réservée à l'état `candidat`, bouton dans l'onglet Candidats) |
| 20/10/2026 | 1.6 | Base légale des 3 ans vérifiée pour les baux meublés et mobilité (colocation par chambre) |
| 20/10/2026 | 1.7 | Exception à la purge : commutateur « Ne pas supprimer » sur les locataires sortis (colonne `conservation_prolongee`) |
| 20/10/2026 | 1.8 | Mail de rappel au propriétaire après chaque purge automatique, pour supprimer les échanges (mails, SMS, papiers) |
| 21/10/2026 | 1.9 | Base de données chez Scaleway (Paris), comptes Render et Koyeb supprimés ; Gmail déclaré comme prestataire d'envoi (transferts hors UE à vérifier) ; E9 traité (HTTPS actif) ; E5 traité ; E6 : texte d'information en annexe A ; E11 ajouté (clé API IAM) ; section 6 bis (lieux d'effacement) ; contact renseigné |
| 21/10/2026 | 1.10 | E12 : chiffrement des colonnes personnelles (code, script de reprise, changement de clé) ; sauvegardes : celles d'avant le chiffrement restent en clair jusqu'à leur suppression |

## Annexe A. Information à remettre aux locataires et candidats

> À joindre au bail ou au courrier qui l'accompagne. Le point entre crochets est à
> confirmer avant l'envoi.

**Information sur l'utilisation de vos données personnelles**

**Qui est responsable ?** [SCI BZHRO — à confirmer], propriétaire du logement, décide de l'usage de vos données.

**Pourquoi ?** Pour établir et gérer votre bail : génération du bail, envoi des documents (par exemple la lettre de congé), suivi de votre entrée et de votre départ. Cet usage repose sur l'exécution du contrat de location, ou sur les démarches précédant sa signature pour une candidature.

**Quelles données ?** Votre nom, prénom, numéro de téléphone, adresse e-mail, date de naissance et profession, ainsi que les informations de votre bail (logement, chambre, loyer, charges, dates).

**Qui y a accès ?** Le propriétaire. Des prestataires techniques les traitent pour son compte et ne les utilisent pas pour eux-mêmes : l'hébergement de l'application et de la base de données (Scaleway, en France) et l'envoi des e-mails (Google, via Gmail, qui peut traiter les données hors de l'Union européenne).

**Combien de temps ?** Pendant la durée du bail, puis **3 ans après votre départ**, délai pendant lequel un litige peut survenir. Vos données sont ensuite supprimées. Si votre candidature n'aboutit pas et que le bail n'est pas signé, elles sont supprimées à votre demande ou dès que la candidature est abandonnée. Certaines pièces comptables ou fiscales peuvent être conservées plus longtemps lorsque la loi l'impose.

**Quels sont vos droits ?** Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, la limitation de leur usage ou vous y opposer. L'effacement peut être refusé lorsque la loi impose de conserver les données ou que celles-ci servent à défendre des droits pendant les 3 ans ; dans ce cas, la réponse est motivée.

**Comment exercer ces droits ?** Écrivez à **sylvain.bodin@gmail.com**. Vous recevrez une réponse sous 1 mois, et un justificatif d'identité pourra vous être demandé. Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (www.cnil.fr).
