import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Chiffrement AES-256-GCM des secrets stockés en base (le refresh token
 * OneDrive). GCM chiffre ET authentifie : un texte altéré en base est détecté
 * au déchiffrement, au lieu de produire n'importe quoi.
 *
 * Format stocké : `v1.<iv>.<tag>.<texte chiffré>`, chaque partie en base64url.
 *   - `iv`  : 12 octets ALÉATOIRES et UNIQUES à chaque chiffrement. Réutiliser
 *             un IV avec la même clé ruinerait la sécurité de GCM ;
 *   - `tag` : 16 octets d'authentification ;
 *   - `v1`  : version du format, pour pouvoir le faire évoluer (rotation de clé).
 */
const VERSION = 'v1';
const TAILLE_CLE = 32;
const TAILLE_IV = 12;

/** Lit la clé (32 octets en base64) et refuse une clé de mauvaise taille. */
export function lireCle(base64: string | undefined): Buffer {
  if (!base64) {
    throw new Error(
      "EDL_ENCRYPTION_KEY est absent de l'environnement : impossible de chiffrer ou déchiffrer le jeton OneDrive. Voir .env.example.",
    );
  }

  const cle = Buffer.from(base64, 'base64');
  if (cle.length !== TAILLE_CLE) {
    throw new Error(
      `EDL_ENCRYPTION_KEY doit faire ${TAILLE_CLE} octets en base64 (reçu : ${cle.length}). ` +
        "Générer avec : node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }

  return cle;
}

export function chiffrer(clair: string, cle: Buffer): string {
  const iv = randomBytes(TAILLE_IV);
  const chiffreur = createCipheriv('aes-256-gcm', cle, iv);
  const chiffre = Buffer.concat([
    chiffreur.update(clair, 'utf8'),
    chiffreur.final(),
  ]);

  return [
    VERSION,
    iv.toString('base64url'),
    chiffreur.getAuthTag().toString('base64url'),
    chiffre.toString('base64url'),
  ].join('.');
}

export function dechiffrer(stocke: string, cle: Buffer): string {
  const [version, iv, tag, chiffre] = stocke.split('.');

  if (version !== VERSION || !iv || !tag || !chiffre) {
    throw new Error('Secret chiffré illisible : format inconnu.');
  }

  try {
    const dechiffreur = createDecipheriv(
      'aes-256-gcm',
      cle,
      Buffer.from(iv, 'base64url'),
    );
    dechiffreur.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      dechiffreur.update(Buffer.from(chiffre, 'base64url')),
      dechiffreur.final(),
    ]).toString('utf8');
  } catch {
    // Message générique : ni la clé ni le contenu ne doivent fuiter dans les logs.
    throw new Error(
      'Secret chiffré illisible : clé incorrecte ou donnée altérée.',
    );
  }
}
