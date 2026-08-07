import { Caracteristique } from '../caracteristique.entity';

/**
 * Reproduit le JSON produit par Jackson pour l'entité Caracteristique :
 * `appartement` portait @JsonIgnore et n'était donc pas sérialisé.
 *
 * À ne pas confondre avec la caractéristique imbriquée dans /appartement, qui
 * expose en plus `appartementId` (cf. CaracteristiqueDto côté appartement).
 */
export class CaracteristiqueResponseDto {
  id: number;
  description: string;

  constructor(caracteristique: Caracteristique) {
    this.id = caracteristique.id;
    this.description = caracteristique.description;
  }
}
