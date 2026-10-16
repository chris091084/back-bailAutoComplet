/** Entrée dans le logement ou sortie : un même modèle de document, deux moments. */
export enum TypeEtatDesLieux {
  ENTREE = 'entree',
  SORTIE = 'sortie',
}

/**
 * Cycle de vie du document : `draft` (le locataire remplit) → `validated`
 * (tout est traité, plus de modification de contenu) → `signed` (verrouillé
 * pour toujours, PDF produit).
 */
export enum StatutEtatDesLieux {
  DRAFT = 'draft',
  VALIDATED = 'validated',
  SIGNED = 'signed',
}

/** Un élément est « à vérifier » tant que le locataire ne l'a pas traité. */
export enum StatutValidation {
  A_VERIFIER = 'a_verifier',
  VALIDE = 'valide',
}

/** Où en est le transfert d'une photo vers OneDrive. */
export enum StatutSyncPhoto {
  PENDING = 'pending',
  SYNCED = 'synced',
}

/** Qui a écrit une ligne d'historique. */
export enum AuteurModification {
  LOCATAIRE = 'locataire',
  BAILLEUR = 'bailleur',
  SYSTEME = 'systeme',
}
