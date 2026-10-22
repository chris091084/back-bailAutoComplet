import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * Chiffrement des colonnes personnelles (RGPD, art. 32) : AES-256-GCM.
 *
 * Une valeur chiffrée s'écrit `enc:v1:` suivi de `iv | tag | texte chiffré` en
 * base64. Le préfixe sert à deux choses : reconnaître une valeur déjà chiffrée
 * (le script de reprise de l'existant est rejouable sans double chiffrement), et
 * lire sans erreur les valeurs encore en clair tant que la reprise n'a pas eu lieu.
 *
 * L'IV est tiré au hasard à chaque écriture : deux écritures de la même valeur
 * donnent deux textes différents. C'est voulu (rien ne se déduit des doublons),
 * mais une colonne chiffrée ne se recherche pas et ne se trie pas en SQL.
 *
 * La clé vient de `ENCRYPTION_KEY` (32 octets en base64), jamais de la base.
 * `ENCRYPTION_KEY_PREVIOUS`, facultative, sert uniquement à LIRE les valeurs
 * écrites avec l'ancienne clé pendant un changement de clé.
 */
export const PREFIXE_CHIFFRE = 'enc:v1:';

const ALGORITHME = 'aes-256-gcm';
const TAILLE_CLE = 32;
const TAILLE_IV = 12;
const TAILLE_TAG = 16;

export type EtatValeur = 'clair' | 'courante' | 'precedente';

interface Cles {
  courante: Buffer;
  precedente: Buffer | null;
}

let cache: { brute: string; precedenteBrute: string; cles: Cles } | null = null;

const decoderCle = (nom: string, brute: string): Buffer => {
  const cle = Buffer.from(brute.trim(), 'base64');

  if (cle.length !== TAILLE_CLE) {
    throw new Error(
      `${nom} doit contenir ${TAILLE_CLE} octets encodés en base64 (${cle.length} lus). ` +
        `Générer une clé : node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }

  return cle;
};

const chargerCles = (): Cles => {
  const brute = process.env.ENCRYPTION_KEY ?? '';
  const precedenteBrute = process.env.ENCRYPTION_KEY_PREVIOUS ?? '';

  if (!brute.trim()) {
    throw new Error(
      "ENCRYPTION_KEY est absent de l'environnement : impossible de lire ni d'écrire " +
        'les colonnes chiffrées. Voir .env.example. Cette clé ne se retrouve nulle part ' +
        'ailleurs : la perdre, c’est perdre les données chiffrées.',
    );
  }

  if (cache?.brute === brute && cache.precedenteBrute === precedenteBrute) {
    return cache.cles;
  }

  const cles: Cles = {
    courante: decoderCle('ENCRYPTION_KEY', brute),
    precedente: precedenteBrute.trim()
      ? decoderCle('ENCRYPTION_KEY_PREVIOUS', precedenteBrute)
      : null,
  };
  cache = { brute, precedenteBrute, cles };

  return cles;
};

export const estChiffree = (valeur: unknown): valeur is string =>
  typeof valeur === 'string' && valeur.startsWith(PREFIXE_CHIFFRE);

/**
 * Empreinte de la clé courante : 8 caractères du SHA-256, non réversibles. Elle
 * permet de vérifier que le conteneur et un script lancé depuis un poste utilisent
 * la MÊME clé, sans jamais afficher la clé elle-même.
 */
export const empreinteCle = (): string =>
  createHash('sha256').update(chargerCles().courante).digest('hex').slice(0, 8);

/** Échoue tout de suite, avec un message clair, si la clé est absente ou invalide. */
export const verifierConfigurationChiffrement = (): string => {
  chargerCles();
  return empreinteCle();
};

export function chiffrer(texte: string): string {
  const { courante } = chargerCles();
  const iv = randomBytes(TAILLE_IV);
  const chiffreur = createCipheriv(ALGORITHME, courante, iv);
  const contenu = Buffer.concat([
    chiffreur.update(texte, 'utf8'),
    chiffreur.final(),
  ]);

  return (
    PREFIXE_CHIFFRE +
    Buffer.concat([iv, chiffreur.getAuthTag(), contenu]).toString('base64')
  );
}

const essayer = (cle: Buffer, valeur: string): string | null => {
  const brut = Buffer.from(valeur.slice(PREFIXE_CHIFFRE.length), 'base64');

  if (brut.length < TAILLE_IV + TAILLE_TAG) {
    return null;
  }

  try {
    const dechiffreur = createDecipheriv(
      ALGORITHME,
      cle,
      brut.subarray(0, TAILLE_IV),
    );
    dechiffreur.setAuthTag(brut.subarray(TAILLE_IV, TAILLE_IV + TAILLE_TAG));

    return Buffer.concat([
      dechiffreur.update(brut.subarray(TAILLE_IV + TAILLE_TAG)),
      dechiffreur.final(),
    ]).toString('utf8');
  } catch {
    // Étiquette d'authentification invalide : mauvaise clé, ou valeur altérée.
    return null;
  }
};

/**
 * Une valeur sans le préfixe est rendue telle quelle : c'est une donnée écrite
 * avant le chiffrement, que le script de reprise convertira.
 */
export function dechiffrer(valeur: string): string {
  if (!estChiffree(valeur)) {
    return valeur;
  }

  const { courante, precedente } = chargerCles();
  const clair =
    essayer(courante, valeur) ??
    (precedente ? essayer(precedente, valeur) : null);

  if (clair === null) {
    throw new Error(
      'Valeur chiffrée illisible : ENCRYPTION_KEY ne correspond pas à la clé qui ' +
        "l'a écrite (ou la valeur a été altérée). Aucune donnée n'est modifiée.",
    );
  }

  return clair;
}

/** `clair` : à chiffrer ; `precedente` : à rechiffrer ; `courante` : rien à faire. */
export function etatValeur(valeur: string): EtatValeur {
  if (!estChiffree(valeur)) {
    return 'clair';
  }

  const { courante, precedente } = chargerCles();

  if (essayer(courante, valeur) !== null) {
    return 'courante';
  }

  if (precedente && essayer(precedente, valeur) !== null) {
    return 'precedente';
  }

  throw new Error(
    'Valeur chiffrée illisible avec ENCRYPTION_KEY et ENCRYPTION_KEY_PREVIOUS : ' +
      'vérifier les clés avant toute modification.',
  );
}
