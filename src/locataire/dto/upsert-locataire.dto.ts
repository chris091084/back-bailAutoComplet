/**
 * Corps accepté en création comme en modification. L'appartement est désigné
 * par son seul identifiant, à l'image d'UpsertChambreDto.
 */
export class UpsertLocataireDto {
  nom?: string;
  prenom?: string;
  telephone?: string | null;
  email?: string | null;
  /**
   * Date de naissance au format « AAAA-MM-JJ » ; `null` explicite l'efface.
   */
  dateNaissance?: string | null;
  /** Profession du locataire ; `null` explicite l'efface. */
  profession?: string | null;
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
