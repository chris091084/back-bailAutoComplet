import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EtatElement } from '../etat-element.enum';
import { StatutValidation } from '../etat-des-lieux.enums';

/** Taille maximale d'un commentaire (le formulaire Word n'en demande pas plus). */
export const COMMENTAIRE_MAX = 2000;

/**
 * Corps de `PATCH /etats-des-lieux/:token/elements/:elementId`.
 *
 * Seuls les champs PRÉSENTS sont écrits : la coche de validation rapide envoie
 * juste `statutValidation`, la modification complète envoie les trois. `null`
 * explicite efface la valeur ; l'absence la laisse intacte.
 */
export class ModifierElementDto {
  @IsOptional()
  @IsEnum(EtatElement)
  etatLocataire?: EtatElement | null;

  @IsOptional()
  @IsString()
  @MaxLength(COMMENTAIRE_MAX)
  commentaireLocataire?: string | null;

  @IsOptional()
  @IsEnum(StatutValidation)
  statutValidation?: StatutValidation;

  /**
   * Instant (ISO 8601) où le locataire a saisi, mesuré par SON appareil. C'est ce
   * qui permet de rejouer une écriture longtemps après une coupure sans écraser
   * une saisie plus récente.
   */
  @IsDateString()
  modifieLe!: string;
}
