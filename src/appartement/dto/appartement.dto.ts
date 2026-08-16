import { Bailleur } from '../../bailleur/bailleur.entity';
import { Caracteristique } from '../../caracteristique/caracteristique.entity';
import { Chambre } from '../../chambre/chambre.entity';
import { Appartement } from '../appartement.entity';

/** Équivalent de ChambreDto côté Java : uniquement id et piece. */
export class ChambreDto {
  id: number;
  piece: string;
  couleur: string | null;

  constructor(chambre: Chambre) {
    this.id = chambre.id;
    this.piece = chambre.piece;
    this.couleur = chambre.couleur;
  }
}

/** Équivalent de CaracteristiqueDto côté Java. */
export class CaracteristiqueDto {
  id: number;
  description: string;
  appartementId: number | null;

  /**
   * `appartementId` est repris du parent lorsque la relation inverse n'est pas
   * hydratée : chargées depuis l'appartement, les caractéristiques ne portent
   * pas de référence retour, alors qu'Hibernate la résolvait via son proxy.
   */
  constructor(caracteristique: Caracteristique, appartementId?: number) {
    this.id = caracteristique.id;
    this.description = caracteristique.description;
    this.appartementId =
      caracteristique.appartement?.id ?? appartementId ?? null;
  }
}

/**
 * Réplique champ pour champ le AppartementDto de l'API Spring Boot : c'est le
 * contrat consommé par le front (bailAutoComplete-Front).
 */
export class AppartementDto {
  id: number;
  name: string;
  adress: string;
  bailleur: Bailleur;
  chambres: ChambreDto[];
  caracteristiques: CaracteristiqueDto[];
  energieHeating: string;
  energieWater: string | null;
  chauffageCollectif: boolean;
  bankName: string | null;
  restrictions: string | null;
  constructionPeriod: string | null;
  surface: number | null;
  charges: number | null;
  loyers: number | null;
  caution: number | null;
  petRule: string | null;
  rentRef: number | null;
  rentRefMaj: number | null;
  valIrl: string | null;
  tIrl: string | null;
  irlManual: boolean;
  prefixeAnnexe: string;
  aLoggia: boolean;
  aGaragePoubelle: boolean;
  etage: string | null;

  constructor(appartement: Appartement) {
    this.id = appartement.id;
    this.name = appartement.name;
    this.adress = appartement.adress;
    this.bailleur = appartement.bailleur;
    // `?? []` : l'appartement fraîchement créé n'a pas encore ses collections
    // chargées. Côté Java, ce cas provoquait un NullPointerException sur POST.
    this.chambres = [...(appartement.chambres ?? [])]
      .sort((a, b) => a.id - b.id)
      .map((chambre) => new ChambreDto(chambre));
    this.caracteristiques = [...(appartement.caracteristiques ?? [])]
      .sort((a, b) => a.id - b.id)
      .map(
        (caracteristique) =>
          new CaracteristiqueDto(caracteristique, appartement.id),
      );
    this.energieHeating = appartement.energieHeating;
    this.energieWater = appartement.energieWater;
    this.chauffageCollectif = appartement.chauffageCollectif;
    this.bankName = appartement.bankName;
    this.restrictions = appartement.restrictions;
    this.constructionPeriod = appartement.constructionPeriod;
    this.surface = appartement.surface;
    this.charges = appartement.charges;
    this.loyers = appartement.loyers;
    this.caution = appartement.caution;
    this.petRule = appartement.petRule;
    this.rentRef = appartement.rentRef;
    this.rentRefMaj = appartement.rentRefMaj;
    this.valIrl = appartement.valIrl;
    this.tIrl = appartement.tIrl;
    this.irlManual = appartement.irlManual;
    this.prefixeAnnexe = appartement.prefixeAnnexe;
    this.aLoggia = appartement.aLoggia;
    this.aGaragePoubelle = appartement.aGaragePoubelle;
    this.etage = appartement.etage;
  }
}
