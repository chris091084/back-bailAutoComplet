export type TypeEtatDesLieuxChemin = 'entree' | 'sortie';

/** Ce que le reste de l'application garde d'un fichier envoyé. */
export interface FichierOneDrive {
  itemId: string;
  webUrl: string;
}

export interface StatutOneDrive {
  /** Les variables d'environnement nécessaires sont posées. */
  configure: boolean;
  connecte: boolean;
  /** Connecté un jour, mais Microsoft a retiré l'accès : reconnexion nécessaire. */
  revoque: boolean;
  connecteLe: string | null;
}
