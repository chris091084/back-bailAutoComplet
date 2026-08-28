import { EtatLocataire } from '../locataire-etat.enum';
import { Locataire } from '../locataire.entity';

/**
 * Vue à plat d'un locataire : l'appartement rattaché n'est exposé que par son
 * id et son nom, pour éviter de renvoyer l'entité complète (et son bailleur
 * chargé en eager) à chaque ligne de la liste.
 */
export class LocataireDto {
  id: number;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
  /**
   * Date de naissance au format « AAAA-MM-JJ », dont le front tire l'âge
   * affiché dans la liste.
   */
  dateNaissance: string | null;
  /** Profession du locataire, saisie au formulaire de bail ou sur la fiche. */
  profession: string | null;
  /**
   * Date d'entrée dans le logement au format « AAAA-MM-JJ », reprise de
   * `result_form.date_from` à la création puis modifiable sur la fiche.
   */
  entree: string | null;
  /**
   * L'état de la fiche, qui décide de l'onglet où elle s'affiche et des actions
   * qu'elle offre. Lecture seule : il se change par `POST /:id/signature`,
   * `POST /:id/sortie` ou `DELETE /:id/sortie`, jamais par `PUT /:id`.
   */
  etat: EtatLocataire;
  appartementId: number | null;
  appartementNom: string | null;
  resultFormId: number | null;
  /**
   * `result_form.date_from`, au format « AAAA-MM-JJ » de la colonne `date` :
   * la date de signature du bail, que le front reporte dans la lettre de congé
   * sans avoir à recharger la génération complète.
   */
  dateSignatureContrat: string | null;
  /**
   * `result_form.price_no_charge` et `result_form.charge_price` : les montants
   * du bail signé, que la quittance de loyer reprend ligne à ligne. Pris sur le
   * bail et non sur l'appartement, une colocation louant chaque chambre à son
   * prix.
   */
  loyerHorsCharges: number | null;
  charges: number | null;
  /**
   * Date d'envoi de la lettre de congé au format ISO, `null` si aucune n'est
   * partie : c'est ce que la liste des locataires affiche.
   */
  resiliationEnvoyeeLe: string | null;
  /**
   * Date de sortie du logement au format « AAAA-MM-JJ », `null` si le locataire
   * est toujours en place : c'est elle qui range la fiche dans la liste des
   * locataires sortis.
   */
  sortie: string | null;
  /**
   * Nom de la pièce issue du bail rattaché (`result_form.room`). `null` si
   * aucun result_form n'est rattaché. Lecture seule.
   */
  chambre: string | null;
  /**
   * Code couleur CSS de la chambre correspondant à ce nom de pièce dans
   * l'appartement du locataire. `null` si la chambre n'a pas de couleur ou si
   * aucun result_form n'est rattaché. Lecture seule.
   */
  chambreCouleur: string | null;

  constructor(locataire: Locataire) {
    this.id = locataire.id;
    this.nom = locataire.nom;
    this.prenom = locataire.prenom;
    this.telephone = locataire.telephone;
    this.email = locataire.email;
    this.dateNaissance = locataire.dateNaissance ?? null;
    this.profession = locataire.profession ?? null;
    this.entree = locataire.entree ?? null;
    this.etat = locataire.etat;
    this.appartementId = locataire.appartement?.id ?? null;
    this.appartementNom = locataire.appartement?.name ?? null;
    this.resultFormId = locataire.resultForm?.id ?? null;
    this.dateSignatureContrat = locataire.resultForm?.from ?? null;
    this.loyerHorsCharges = locataire.resultForm?.priceNoCharge ?? null;
    this.charges = locataire.resultForm?.chargePrice ?? null;
    // `new Date` plutôt que `.toISOString()` directement : selon le pilote, une
    // colonne timestamptz peut remonter en chaîne plutôt qu'en Date.
    this.resiliationEnvoyeeLe = locataire.resiliationEnvoyeeLe
      ? new Date(locataire.resiliationEnvoyeeLe).toISOString()
      : null;
    this.sortie = locataire.sortie ?? null;
    this.chambre = locataire.resultForm?.room ?? null;
    const chambreEntity = this.chambre
      ? locataire.appartement?.chambres?.find((c) => c.piece === this.chambre)
      : undefined;
    this.chambreCouleur = chambreEntity?.couleur ?? null;
  }
}
