/**
 * Durée de vie par défaut d'un lien envoyé au locataire. Un état des lieux se
 * remplit le jour de l'entrée ou de la sortie : un mois laisse de la marge sans
 * laisser un lien valable indéfiniment dans une boîte mail.
 */
const TTL_PAR_DEFAUT_JOURS = 30;

/**
 * Clé de signature des liens locataire. Volontairement DISTINCTE de
 * `JWT_ACCESS_SECRET` : un jeton de lien ne doit jamais pouvoir être accepté
 * comme une session du bailleur, ni l'inverse.
 *
 * Lue à l'usage et non au démarrage : le module est récent, une variable
 * manquante ne doit pas empêcher le reste de l'API de démarrer (le module
 * journalise un avertissement au boot).
 */
export const edlTokenSecret = (): string => {
  const secret = process.env.EDL_TOKEN_SECRET;

  if (!secret) {
    throw new Error(
      "EDL_TOKEN_SECRET est absent de l'environnement : les liens d'état des " +
        'lieux ne peuvent être ni créés ni vérifiés. Voir .env.example.',
    );
  }

  return secret;
};

export const edlTokenSecretConfigure = (): boolean =>
  Boolean(process.env.EDL_TOKEN_SECRET);

export const edlTokenTtlJours = (): number => {
  const valeur = Number(process.env.EDL_TOKEN_TTL_DAYS);
  return Number.isFinite(valeur) && valeur > 0 ? valeur : TTL_PAR_DEFAUT_JOURS;
};

/** Public visé par le jeton (`aud`) : un second garde-fou contre la confusion de jetons. */
export const EDL_TOKEN_AUDIENCE = 'edl-locataire';

/**
 * Racine du front, pour construire le lien. Par défaut l'origine CORS : c'est
 * déjà, par définition, l'adresse du front.
 */
export const edlFrontBaseUrl = (): string =>
  (
    process.env.EDL_FRONT_BASE_URL ??
    process.env.CORS_ORIGIN ??
    'http://localhost:4200'
  ).replace(/\/+$/, '');
