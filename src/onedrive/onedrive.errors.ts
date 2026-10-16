/**
 * Pourquoi OneDrive n'a pas pu servir. Dans tous les cas la photo n'est PAS
 * perdue : l'appareil du locataire la garde et la renverra.
 *
 *   NON_CONFIGURE / NON_CONNECTE : le bailleur n'a pas (encore) connecté OneDrive
 *   REVOQUE   : l'accès a été retiré (mot de passe changé, appli révoquée…) :
 *               il faut se reconnecter depuis la page d'administration
 *   LIMITE    : trop de requêtes (429), `retryAfterSecondes` dit quand revenir
 *   QUOTA     : OneDrive plein (507)
 *   INDISPONIBLE : erreur réseau ou 5xx chez Microsoft
 */
export type CauseOneDrive =
  | 'NON_CONFIGURE'
  | 'NON_CONNECTE'
  | 'REVOQUE'
  | 'LIMITE'
  | 'QUOTA'
  | 'INDISPONIBLE';

export class OneDriveIndisponibleError extends Error {
  constructor(
    readonly cause_: CauseOneDrive,
    message: string,
    readonly retryAfterSecondes?: number,
  ) {
    super(message);
    this.name = 'OneDriveIndisponibleError';
  }
}
