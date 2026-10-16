import { EtatElement } from './etat-element.enum';

/** Libellés du formulaire Word pour les cinq niveaux d'état. */
export const LIBELLES_ETAT: Record<EtatElement, string> = {
  [EtatElement.NEUF]: 'Neuf',
  [EtatElement.TRES_BON]: 'Très bon état',
  [EtatElement.BON]: 'Bon état',
  [EtatElement.MOYEN]: 'État moyen',
  [EtatElement.MAUVAIS]: 'Mauvais état',
};

export const libelleEtat = (etat: EtatElement | null): string =>
  etat ? LIBELLES_ETAT[etat] : '';
