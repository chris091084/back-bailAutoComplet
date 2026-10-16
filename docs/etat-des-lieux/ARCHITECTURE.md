# Architecture

## Vue d'ensemble

```
 ┌──────────── Téléphone du locataire ────────────┐        ┌────────── API NestJS (Scaleway) ───────────┐
 │ Page Angular /edl/<jeton>                      │        │  EtatDesLieuxPublicController  (jeton)     │
 │  ├─ Store (signals) = base serveur + saisies   │  HTTPS │  EtatDesLieuxController        (bailleur)  │
 │  ├─ SyncQueueService ── rejoue ──────────────────────────►  RgpdController               (bailleur)  │
 │  └─ IndexedDB : saisies, photos (Blob), copie  │        │  OneDriveController            (bailleur)  │
 └────────────────────────────────────────────────┘        │      │              │                      │
                                                           │  PostgreSQL     OneDriveService ──► Microsoft Graph ──► OneDrive du bailleur
 ┌──────── Navigateur du bailleur ────────┐                │  EdlPdfService ──► Chromium (Puppeteer)    │
 │ /etats-des-lieux · /onedrive (session) │───────────────►│  MailService ──► SMTP                      │
 └────────────────────────────────────────┘                └────────────────────────────────────────────┘
```

Deux « identités » :

| Qui | Comment il s'authentifie | Routes |
|---|---|---|
| **Bailleur** | session existante (cookie `httpOnly`, guard global) | `/etats-des-lieux` (sans jeton), `/onedrive`, `/rgpd/…` |
| **Locataire** | **jeton** dans l'URL : JWT signé (`EDL_TOKEN_SECRET`), durée limitée, révocable | `/etats-des-lieux/:token/…`, marquées `@Public()` + `EdlTokenGuard` |

## Modèle de données

```
 locataire ─┐                       etat_des_lieux ────────────┐
 appartement┴──► (FK)  id uuid · type entree|sortie · statut draft|validated|signed
                       etat_entree_ref_id ──► (autre état d'entrée, pour une sortie)
                       adresse, chauffage, cles_remises   (figés à la création)
                       lien_jti, lien_expire_le           (version du lien : le régénérer révoque l'ancien)
                       signature_*, date_signature, empreinte (SHA-256), pdf_envoye_le, pdf_onedrive_item_id
                          │ 1..n
                       edl_piece (nom, ordre)
                          │ 1..n
                       edl_element (nom, ordre, element_entree_ref_id,
                          │         etat/commentaire BAILLEUR (référence, lecture seule côté locataire),
                          │         etat/commentaire LOCATAIRE, date_modif_locataire, statut_validation)
                          ├─ 0..5 edl_photo (id choisi par l'appareil, onedrive_item_id, onedrive_url)
                          └─ 0..n edl_element_historique (avant/après en JSON, auteur, horodatages)

 onedrive_connexion  (une seule ligne) : refresh_token_chiffre (AES-256-GCM), statut connecte|revoque
```

## Cycle de vie d'un document

```
            PATCH éléments, photos
          ┌───────────────┐
          ▼               │
       ┌──────┐  validate (tout traité)  ┌───────────┐   sign   ┌────────┐
       │ draft │────────────────────────►│ validated │─────────►│ signed │  ← définitif
       └──────┘◄────── reouvrir ─────────┴───────────┘          └────────┘
          ▲   (bailleur seulement)                    sign accepté aussi depuis « draft »
          └── éléments modifiables UNIQUEMENT ici            (il revérifie que tout est traité)
```

Après `signed` : plus aucune écriture (le guard répond 409 `DEJA_SIGNE`), ni même un nouveau lien.

## Flux clés

### 1. Saisie d'un élément (hors ligne compris)

```
 clic ✓ ─► SyncQueue.enregistrer ─► ① IndexedDB ─► ② PATCH /elements/:id {…, modifieLe}
                                                         │
          réseau coupé / 5xx / 429 ◄── échec ────────────┤ conflit : serveur plus récent → 409 + sa version
          reste « en attente » (⟳ orange)                ▼
          rejoué : saisie · « online » · 15→30 s    ok → retirée de la file (✓ vert)
```

Règle de conflit : le serveur refuse si **son** horodatage est *strictement plus récent*. Un rejeu à
l'identique est accepté sans rien réécrire (idempotent).

### 2. Photo

```
 « Ajouter » ─► compression 1600 px JPEG (EXIF effacé) ─► IndexedDB (Blob) ─► POST multipart (id UUID de l'appareil)
 serveur : jeton ✓ · octets = vraie image ✓ · ≤ 5 par élément ✓ · document modifiable ✓
           ─► PUT Graph …/approot:/{adresse}/{locataire}/{entree|sortie}/{piece}/{element}-{date}-{id}.jpg
           ─► enregistre id + lien. OneDrive KO ? ─► 503 + Retry-After : la photo reste sur le téléphone.
```

### 3. Signature

```
 « Tout valider et signer » (actif si : tout traité ET rien en attente ET serveur confirmé)
   ─► pad ─► POST /validate ─► POST /sign
        transaction (verrou) : tout traité ? ─► signatures, date, statut « signed », empreinte SHA-256
        puis, hors transaction (peut échouer sans annuler la signature) :
        PDF (Chromium) ─► archive OneDrive ─► e-mail locataire ─► e-mail bailleur
        réponse : { pdf, emailLocataire, emailBailleur, archive } ─► « Renvoyer » (bailleur) rattrape
```

## Choix de conception à connaître

- **Le téléphone est le tampon, pas le serveur.** Le conteneur n'a pas de disque durable : une photo n'existe côté serveur qu'une fois sur OneDrive ; d'ici là elle est dans IndexedDB.
- **Une saisie en attente par élément**, fusionnée champ par champ (le dernier mot l'emporte) : pas d'historique d'étapes à rejouer.
- **Écran = base serveur + saisies en attente** : l'interface affiche le même état qu'on soit en ligne ou non.
- **Signature = transaction courte ; PDF/e-mail = suites.** La signature est acquise même si Chromium, le SMTP ou OneDrive tombent.
- **Aucun SDK Azure** : `fetch` natif suffit. **Un seul navigateur Chromium à la fois**, lancé puis fermé à chaque PDF.
- **Preuve d'intégrité** : l'empreinte SHA-256 du contenu est calculée à la signature et imprimée sur le PDF (ce n'est pas une signature qualifiée eIDAS).

## Sécurité en bref

Jeton signé à durée limitée et révocable · `helmet` · CORS restreint · limitation de débit sur chaque route publique ·
DTO validés (`whitelist`, `forbidNonWhitelisted`) · uploads : taille + octets réels · `Cache-Control: no-store` sur les
données personnelles · refresh token OneDrive chiffré (AES-256-GCM, IV unique) · logs sans jeton, signature,
commentaire ni adresse e-mail complète (vérifié par un test e2e) · HTTPS imposé par `FORCE_HTTPS`.
