import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EtatElement } from '../etat-element.enum';
import { TypeEtatDesLieux } from '../etat-des-lieux.enums';

export class ElementModeleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nom!: string;

  /** Valeur de référence pré-remplie par le bailleur (facultative). */
  @IsOptional()
  @IsEnum(EtatElement)
  etatBailleur?: EtatElement;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commentaireBailleur?: string;
}

export class PieceModeleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nom!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ElementModeleDto)
  elements!: ElementModeleDto[];
}

/** Corps de `POST /etats-des-lieux` (côté bailleur). */
export class CreateEtatDesLieuxDto {
  @IsInt()
  @Min(1)
  locataireId!: number;

  @IsEnum(TypeEtatDesLieux)
  type!: TypeEtatDesLieux;

  /**
   * Pièces et éléments du document. Absent : une sortie reprend ceux de l'état
   * d'entrée de référence, une entrée part du modèle par défaut.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PieceModeleDto)
  pieces?: PieceModeleDto[];

  /**
   * Sortie uniquement : l'état d'entrée de référence. Absent, le dernier état
   * d'entrée signé de ce locataire est retenu s'il existe.
   */
  @IsOptional()
  @IsUUID()
  etatEntreeRefId?: string;

  /** Absent : repris de la fiche du logement. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  chauffage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clesRemises?: string;
}
