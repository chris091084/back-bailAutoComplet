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

  constructor(locataire: Locataire) {
    this.id = locataire.id;
    this.nom = locataire.nom;
    this.prenom = locataire.prenom;
    this.telephone = locataire.telephone;
    this.email = locataire.email;
    this.appartementId = locataire.appartement?.id ?? null;
    this.appartementNom = locataire.appartement?.name ?? null;
  }
}
