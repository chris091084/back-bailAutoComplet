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

  constructor(locataire: Locataire) {
    this.id = locataire.id;
    this.nom = locataire.nom;
    this.prenom = locataire.prenom;
    this.telephone = locataire.telephone;
    this.email = locataire.email;
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
  }
}
