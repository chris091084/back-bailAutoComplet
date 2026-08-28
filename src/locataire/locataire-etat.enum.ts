/**
 * Le cycle de vie d'une fiche locataire, du bail généré au départ du logement.
 *
 * Les valeurs sont stockées telles quelles dans la colonne `locataire.etat` et
 * renvoyées telles quelles au front : minuscules et sans accent, pour qu'elles
 * traversent l'URL de `GET /locataire?etat=…` sans encodage.
 */
export enum EtatLocataire {
  /**
   * Le bail est généré, rien n'est signé. C'est l'état de toute fiche créée :
   * éditer un bail ne fait pas encore un occupant.
   */
  CANDIDAT = 'candidat',

  /** Le bail est signé : la fiche donne accès aux quittances et au congé. */
  LOCATAIRE = 'locataire',

  /** Le logement est quitté. La date du départ est dans `sortie`. */
  SORTI = 'sorti',
}
