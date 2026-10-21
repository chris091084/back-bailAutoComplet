# Registre des activités de traitement (RGPD, article 30)

> Document vivant : à relire et à mettre à jour à chaque évolution qui touche
> aux données personnelles (nouveau champ, nouveau prestataire, nouvelle
> fonctionnalité). Il doit pouvoir être présenté à la CNIL sur demande.
>
> **Version 1.8 — 20/10/2026.** Brouillon établi à partir du code. Les points
> marqués ⚠️ **À CONFIRMER** demandent une décision ou une vérification humaine.
> Ce document n'est pas un avis juridique.

## 1. Responsable de traitement

| Élément | Valeur |
|---|---|
| Responsable de traitement | ⚠️ **À CONFIRMER** : la SCI (bailleur du seed `SeedBailleurSci`) ou le propriétaire en personne |
| Adresse | ⚠️ À renseigner |
| Contact pour les questions RGPD | ⚠️ À renseigner (adresse e-mail dédiée) |
| DPO (délégué à la protection des données) | Non désigné (non obligatoire pour cette activité) |

## 2. Vue d'ensemble des flux

```
Propriétaire ──► Front Angular (Vercel)
                      │
                      ▼
                API NestJS (Scaleway) ──► BDD PostgreSQL (Render, Francfort)
                      │
                      ├──► LibreOffice (dans le conteneur de l'API) : .docx → PDF
                      │
                      └──► Serveur SMTP ──► e-mail du locataire (+ copie cachée MAIL_BCC)
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
| Destinataires | Le propriétaire (seul utilisateur de l'application) ; hébergeur de la base (Render) |
| Transferts hors UE | Non (région Francfort) |
| Durée de conservation | **3 ans après la sortie** (prescription des actions nées du bail : art. 7-1 de la loi 89-462 du 6 juillet 1989, rendu applicable aux meublés en résidence principale par l'art. 25-3 et au bail mobilité par l'art. 25-12, vérifié sur Légifrance le 20/10/2026 ; couvre les trois types de bail de l'application : mobilité, étudiant, durée indéterminée). **Exception** : le propriétaire peut exclure un locataire sorti de la purge (litige en cours, obligation de conservation plus longue) avec le commutateur « Ne pas supprimer » de l'onglet Locataires sortis, puis suppression de la fiche, du bail (`result_form`) et de l'historique de génération (`generation`) : voir E1. ⚠️ **À CONFIRMER** : les obligations comptables et fiscales peuvent justifier plus long pour certaines pièces (quittances, justificatifs de revenus fonciers) ; elles ne sont pas stockées par l'application |
| Sécurité | Accès par authentification forte (T3), connexion chiffrée (HTTPS), base accessible en SSL avec vérification du certificat (E7, à activer en production), rôle unique côté application |

### T2 — Génération et envoi des documents (bail, congé)

| Mention | Contenu |
|---|---|
| Finalité | Produire le bail et la lettre de congé, et envoyer le courrier au locataire par e-mail avec pièce jointe |
| Personnes concernées | Locataires |
| Données | Identité, adresse du logement, chambre, loyer et charges, indice IRL appliqué, motif du congé, e-mail du locataire ; copie des mêmes données dans la pièce jointe |
| Données sensibles | Aucune. Le champ « motif » est libre : éviter d'y saisir des informations de santé ou de situation personnelle |
| Base légale | Exécution du contrat (art. 6.1.b) et obligation légale de notifier le congé |
| Destinataires | Le locataire ; le fournisseur SMTP ; l'adresse en copie cachée `MAIL_BCC` (archivage des courriers expédiés, voir E8) |
| Transferts hors UE | ⚠️ **À CONFIRMER** selon le fournisseur SMTP (si Gmail : transfert possible vers les États-Unis, à encadrer par les clauses contractuelles types ou la certification Data Privacy Framework du fournisseur) |
| Durée de conservation | Données en base : voir T1. Courriers envoyés : durée de conservation de la boîte `MAIL_BCC` ⚠️ **À CONFIRMER** |
| Sécurité | SMTP en TLS, mot de passe d'application (pas le mot de passe du compte), documents non stockés côté API |

### T3 — Authentification du propriétaire

| Mention | Contenu |
|---|---|
| Finalité | Réserver l'accès à l'application au propriétaire et sécuriser les sessions |
| Personnes concernées | Le propriétaire (compte unique, plusieurs adresses autorisées possibles) |
| Données | Hash bcrypt du mot de passe, passkeys (clé publique, identifiant, compteur, libellé, dates d'usage), hash du lien magique et son expiration, hash du jeton de rafraîchissement, adresses e-mail autorisées (variable d'environnement `AUTH_OWNER_EMAIL`) |
| Données sensibles | Aucune (aucune donnée biométrique stockée : seul le navigateur ou le système la manipule) |
| Base légale | Intérêt légitime : sécurité du système (art. 6.1.f) |
| Destinataires | Hébergeur de la base ; fournisseur SMTP pour le lien magique (ce mail n'est jamais mis en copie cachée) |
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
| Render | Base PostgreSQL | Toutes les données de T1 à T4 | Francfort (UE) | ⚠️ À vérifier |
| Fournisseur SMTP | Envoi des e-mails | E-mail, identité, pièce jointe | ⚠️ **À CONFIRMER** (Gmail ?) | ⚠️ À vérifier |
| Koyeb | Cité dans le schéma de `doc-deploiement-backend.md` | — | — | Probablement abandonné : le front de production appelle Scaleway (`environment.prod.ts`). ⚠️ À confirmer, puis corriger les schémas des docs de déploiement et supprimer l'éventuel compte |

Non concerné : l'API INSEE de l'IRL (indice public, aucune donnée personnelle
n'est envoyée).

## 5. Écarts constatés dans le code (à traiter)

| # | Constat | Pourquoi c'est un sujet | Piste |
|---|---|---|---|
| E1 | Aucune purge des locataires : la « sortie » remplace la suppression, les fiches sortis restent indéfiniment | Principe de **limitation de la conservation** (art. 5.1.e) | 🔧 Purge ajoutée (v1.4) : `npm run purge:locataires` (essai à blanc) puis `-- --execute`, et automatique au démarrage de l'API avec `PURGE_LOCATAIRES=true` (désactivée par défaut). **À activer** en production après un essai à blanc. Les **candidats** (bail généré, jamais signé) n'ont pas de date de sortie : le délai ne court pas pour eux, ils se suppriment **à la main** depuis l'écran Locataires, onglet Candidats, bouton « Supprimer » (v1.5), qui efface la fiche, le bail et l'historique de génération. ⚠️ Le propriétaire doit penser à les supprimer quand une candidature n'aboutit pas. Après chaque purge automatique, un **mail de rappel** part aux adresses de `AUTH_OWNER_EMAIL` (sans copie cachée), avec la liste des anciens locataires et leurs adresses : le propriétaire supprime alors à la main leurs échanges (mails, SMS, papiers). Le message contient ces adresses et se retrouve dans la recherche : il se supprime avec le reste. Reste hors périmètre : les saisies de bail jamais générées (« brouillons »), supprimables depuis le formulaire de bail |
| E2 | Table `login_failure` sans purge | Adresses IP gardées sans limite | Supprimer les lignes de plus de X jours (planifié ou à l'écriture) |
| E3 | ✅ **Corrigé (v1.1).** `mail.service.ts` journalisait « Mail envoyé à *adresse* » | L'e-mail du locataire se retrouvait dans les journaux, avec leur propre rétention | Les logs portent désormais l'identifiant du message, plus l'adresse. Restent à vérifier : la rétention Scaleway, et le fait que la pile d'une erreur SMTP peut citer une adresse |
| E4 | Champ libre `motif` du congé | Risque de saisir des données sensibles | Consigne d'usage, ou liste de motifs prédéfinis |
| E5 | Pas de procédure pour les droits des personnes | Accès, rectification, effacement, à traiter sous 1 mois | Voir section 6 |
| E6 | Pas de mention d'information remise aux locataires | Obligation d'informer (art. 13) | Ajouter un paragraphe au bail ou un document joint |
| E7 | 🔧 **Code prêt (v1.1), à activer.** La connexion à la base chiffrait mais ne vérifiait pas le certificat (`rejectUnauthorized: false`) | Un intermédiaire pourrait se faire passer pour la base (art. 32) | Renseigner `DB_SSL_CA` (certificat de l'autorité) ou `DB_SSL_VERIFY=true` chez l'hébergeur de l'API. Sans l'un des deux, un avertissement est journalisé au démarrage |
| E8 | La copie cachée `MAIL_BCC` duplique chaque bail PDF (données complètes du locataire) dans une boîte personnelle | C'est un traitement à part entière : finalité d'archivage, durée et sécurité de cette boîte à définir | Voir T2 : confirmer la finalité, la durée de conservation, et protéger la boîte (mot de passe fort, double authentification) |
| E9 | Option « HTTPS connections only » **désactivée** sur le conteneur Scaleway (constat sur la console) | L'API répond aussi en HTTP non chiffré : un mot de passe, un cookie ou un bail pourrait circuler en clair si un client appelle l'adresse en `http://` (art. 32) | Activer l'option dans Scaleway (onglet Network & Domains) |
| E10 | Le front Vercel n'envoyait aucun en-tête de sécurité (anti-affichage dans un cadre, anti-détournement de type de fichier) | Défense en profondeur (art. 32) | 🔧 `vercel.json` ajouté (v1.3), effectif au prochain déploiement. Une politique CSP plus stricte reste possible, à tester avec le login par passkey |

## 6. Droits des personnes (procédure minimale)

Le locataire peut demander l'accès à ses données, leur rectification, leur
effacement (dans les limites des obligations légales de conservation), la
limitation ou l'opposition au traitement.

```
Demande reçue ──► vérifier l'identité ──► repérer la fiche (table locataire + result_form)
      │                                          │
      └─ réponse sous 1 mois ◄── export / correction / suppression
```

Contact : ⚠️ à renseigner (voir section 1).

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
