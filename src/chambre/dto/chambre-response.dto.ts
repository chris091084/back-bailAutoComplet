import { Chambre } from '../chambre.entity';

/**
 * Reproduit exactement le JSON que Jackson produisait pour l'entité Chambre :
 * `appartement` portait @JsonIgnore et `caracteristiqueExceptionelle` n'avait
 * pas de getter, ces deux champs n'étaient donc jamais sérialisés.
 */
export class ChambreResponseDto {
  id: number;
  piece: string;

  constructor(chambre: Chambre) {
    this.id = chambre.id;
    this.piece = chambre.piece;
  }
}
