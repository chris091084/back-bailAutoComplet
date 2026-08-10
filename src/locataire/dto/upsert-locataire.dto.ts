/**
 * Corps accepté en création comme en modification. L'appartement est désigné
 * par son seul identifiant, à l'image d'UpsertChambreDto.
 */
export class UpsertLocataireDto {
  nom?: string;
  prenom?: string;
  telephone?: string | null;
  email?: string | null;
  /** Année de naissance ; `null` explicite l'efface. */
  anneeNaissance?: number | null;
  /**
   * Date d'entrée au format « AAAA-MM-JJ ». Absente à la création, elle est
   * reprise de `result_form.date_from` ; `null` explicite l'efface.
   */
  entree?: string | null;
  appartementId?: number;
  /**
   * `null` explicite pour détacher le locataire de son result_form ; absent, la
   * liaison existante est conservée.
   */
  resultFormId?: number | null;
}
