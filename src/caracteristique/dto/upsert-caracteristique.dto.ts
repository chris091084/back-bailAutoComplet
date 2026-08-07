/**
 * Comme pour Chambre, l'entité Java n'exposait pas son appartement à la
 * désérialisation : `appartementId` est ajouté pour que la création soit
 * réellement utilisable.
 */
export class UpsertCaracteristiqueDto {
  description?: string;
  appartementId?: number;
}
