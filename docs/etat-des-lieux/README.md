# État des lieux numérique

Le locataire remplit son état des lieux (entrée ou sortie) depuis **un lien**, sur mobile ou
ordinateur, sans compte ni installation. Il signe à l'écran ; un PDF est envoyé aux deux parties et
archivé dans le OneDrive du bailleur, avec les photos.

| Document | Pour quoi |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Comment c'est construit : schémas, modèle de données, flux |
| [LANCEMENT-LOCAL.md](LANCEMENT-LOCAL.md) | Faire tourner et tester en local |
| [VARIABLES.md](VARIABLES.md) | Toutes les variables d'environnement |
| [ONEDRIVE.md](ONEDRIVE.md) | Inscrire l'application Azure et connecter OneDrive |
| [SECRETS.md](SECRETS.md) | Où mettre les secrets, comment les générer et les renouveler |
| [RGPD.md](RGPD.md) | Données traitées, durées, droits, sous-traitants |
| [DECISIONS.md](DECISIONS.md) | Les choix faits sans te consulter, et comment les changer |

## En deux minutes

```
 Bailleur (connecté)                          Locataire (sans compte)
 ───────────────────                          ───────────────────────
 /etats-des-lieux : « Créer »  ──► lien ──►   ouvre le lien ─► valide d'un clic / modifie / photographie
                                                              ─► « Tout valider et signer » (pad de signature)
 reçoit le PDF + archive OneDrive  ◄───────────────────────── PDF envoyé aux deux, document verrouillé
```

Où est le code :

```
back-bailAutoComplet/src/etat-des-lieux/   API (NestJS) : documents, photos, signature, PDF, RGPD
back-bailAutoComplet/src/onedrive/         connexion OneDrive (OAuth délégué) et fichiers
bailAutoComplete-Front/src/app/etat-des-lieux/        page du locataire (Angular)
bailAutoComplete-Front/src/app/etats-des-lieux-admin/ page du bailleur : créer, envoyer, suivre
bailAutoComplete-Front/src/app/onedrive/               page « Connecter OneDrive »
```
