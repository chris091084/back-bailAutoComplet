import { IsHexColor, IsOptional, ValidateIf } from 'class-validator';

/**
 * L'API Java attendait ici l'entité Chambre elle-même. Son champ `appartement`
 * portant @JsonIgnore, il était impossible de rattacher la chambre à un
 * appartement depuis le corps de la requête : on accepte donc `appartementId`
 * en plus, sans rien retirer de l'ancien contrat.
 */
export class UpsertChambreDto {
  piece?: string;
  appartementId?: number;
  caracteristiqueExceptionelle?: string | null;

  @IsOptional()
  @ValidateIf((o: UpsertChambreDto) => o.couleur !== null)
  @IsHexColor()
  couleur?: string | null;
}
