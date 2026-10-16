import { TypeEtatDesLieuxChemin } from './onedrive.types';

/**
 * Arborescence des photos dans le dossier applicatif :
 *
 *   /{adresse}/{locataire}/{entree|sortie}/{piece}/{element}-{horodatage}-{id}.jpg
 *
 * Chaque segment est « nettoyé » : OneDrive refuse certains caractères
 * (`\ / : * ? " < > | # %`) et les noms qui finissent par un point ou un espace.
 */
const INTERDITS = /[\\/:*?"<>|#%\u0000-\u001f]/g;
const LONGUEUR_MAX = 80;

export function segmentSur(texte: string, secours: string): string {
  const nettoye = texte
    .replace(INTERDITS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, LONGUEUR_MAX)
    .trim();

  return nettoye === '' ? secours : nettoye;
}

/** `20261015-103000` en UTC : triable, sans caractère interdit. */
export const horodatageFichier = (date: Date): string =>
  date.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

export interface ParamsChemin {
  adresse: string;
  locataire: string;
  type: TypeEtatDesLieuxChemin;
  piece: string;
  element: string;
  date: Date;
  /** Identifiant de la photo : évite qu'un même élément photographié à la seconde près se heurte. */
  photoId: string;
  extension: 'jpg' | 'png' | 'webp';
}

export function construireChemin(p: ParamsChemin): string {
  const fichier = `${segmentSur(p.element, 'element')}-${horodatageFichier(p.date)}-${p.photoId.slice(0, 8)}.${p.extension}`;

  return [
    segmentSur(p.adresse, 'logement'),
    segmentSur(p.locataire, 'locataire'),
    p.type,
    segmentSur(p.piece, 'piece'),
    fichier,
  ].join('/');
}

/** Dossier d'un état des lieux (sans le fichier) : sert aussi à ranger le PDF. */
export function construireDossier(
  p: Pick<ParamsChemin, 'adresse' | 'locataire' | 'type'>,
): string {
  return [
    segmentSur(p.adresse, 'logement'),
    segmentSur(p.locataire, 'locataire'),
    p.type,
  ].join('/');
}

/** Encode chaque segment pour l'URL Graph, en gardant les `/` séparateurs. */
export const encoderChemin = (chemin: string): string =>
  chemin.split('/').map(encodeURIComponent).join('/');
