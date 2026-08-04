/**
 * Corps accepté en création comme en modification. L'appartement est désigné
 * par son seul identifiant, à l'image d'UpsertChambreDto.
 */
export class UpsertLocataireDto {
  nom?: string;
  prenom?: string;
  telephone?: string | null;
  email?: string | null;
  appartementId?: number;
  /**
   * `null` explicite pour détacher le locataire de son result_form ; absent, la
   * liaison existante est conservée.
   */
  resultFormId?: number | null;
}
