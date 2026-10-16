import { lireCle } from '../common/chiffrement';

/**
 * Configuration OneDrive, lue dans l'environnement À L'USAGE : l'API démarre
 * sans, seules les fonctions photos répondent alors « OneDrive non configuré ».
 *
 * Aucune valeur sensible n'a de défaut dans le code : `ONEDRIVE_CLIENT_SECRET`
 * et `EDL_ENCRYPTION_KEY` viennent du coffre / de l'hébergeur, injectés comme
 * variables d'environnement au démarrage du conteneur.
 */

/**
 * Compte Microsoft PERSONNEL : l'autorité est `consumers`. Les permissions
 * « application » (client credentials) n'existent pas pour ces comptes : seul le
 * flux délégué (le bailleur se connecte une fois) fonctionne.
 */
export const onedriveTenant = (): string =>
  process.env.ONEDRIVE_TENANT?.trim() || 'consumers';

export const URL_AUTORISATION = (): string =>
  `https://login.microsoftonline.com/${onedriveTenant()}/oauth2/v2.0/authorize`;

export const URL_JETON = (): string =>
  `https://login.microsoftonline.com/${onedriveTenant()}/oauth2/v2.0/token`;

export const URL_GRAPH = 'https://graph.microsoft.com/v1.0';

/**
 * Périmètre minimal : le dossier applicatif dédié (`Applications/<nom de
 * l'appli>`), jamais l'accès à tout le OneDrive. `offline_access` donne le
 * refresh token, sans lequel il faudrait se reconnecter toutes les heures.
 */
export const SCOPES = 'Files.ReadWrite.AppFolder offline_access';

export interface ConfigOneDrive {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export const onedriveConfigure = (): boolean =>
  Boolean(
    process.env.ONEDRIVE_CLIENT_ID &&
    process.env.ONEDRIVE_CLIENT_SECRET &&
    process.env.ONEDRIVE_REDIRECT_URI &&
    process.env.EDL_ENCRYPTION_KEY,
  );

export function configOneDrive(): ConfigOneDrive {
  const { ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET, ONEDRIVE_REDIRECT_URI } =
    process.env;

  if (
    !ONEDRIVE_CLIENT_ID ||
    !ONEDRIVE_CLIENT_SECRET ||
    !ONEDRIVE_REDIRECT_URI
  ) {
    throw new Error(
      'OneDrive non configuré : renseignez ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET et ONEDRIVE_REDIRECT_URI.',
    );
  }

  return {
    clientId: ONEDRIVE_CLIENT_ID,
    clientSecret: ONEDRIVE_CLIENT_SECRET,
    redirectUri: ONEDRIVE_REDIRECT_URI,
  };
}

/** Clé AES-256 du chiffrement du refresh token. */
export const cleChiffrement = (): Buffer =>
  lireCle(process.env.EDL_ENCRYPTION_KEY);
