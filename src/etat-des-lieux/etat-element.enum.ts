/**
 * Les cinq niveaux d'état du formulaire Word, du meilleur au pire. Les valeurs
 * sont des codes courts stockés tels quels dans `edl_element` et renvoyés tels
 * quels au front, qui se charge des libellés (« Très bon état »…).
 */
export enum EtatElement {
  NEUF = 'NEUF',
  TRES_BON = 'TRES_BON',
  BON = 'BON',
  MOYEN = 'MOYEN',
  MAUVAIS = 'MAUVAIS',
}
