import { IsUUID } from 'class-validator';

/**
 * Champ texte du formulaire multipart de `POST …/elements/:id/photos` (le
 * fichier, lui, est dans le champ `photo`). L'identifiant est choisi par le
 * client à la prise de vue : un envoi rejoué après une coupure retombe sur la
 * même photo au lieu d'en créer une seconde.
 */
export class AjouterPhotoDto {
  @IsUUID()
  id!: string;
}
