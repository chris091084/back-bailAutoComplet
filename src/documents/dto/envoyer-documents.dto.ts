import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Champs texte du formulaire de `POST /documents/envoyer`. Les documents
 * eux-mêmes arrivent à part, en fichiers, dans le champ `documents`.
 */
export class EnvoyerDocumentsDto {
  @IsEmail()
  to!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;
}
