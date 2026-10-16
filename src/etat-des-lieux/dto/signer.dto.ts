import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Corps de `POST …/sign`. Chaque signature est un PNG en base64 (avec ou sans
 * préfixe `data:image/png;base64,`). La plus grosse accepte ~270 000 caractères
 * (200 ko décodés) : le contrôle exact se fait dans `normaliserSignature`.
 */
export class SignerDto {
  @IsString()
  @MaxLength(300_000)
  signatureLocataire!: string;

  /** Facultative : le bailleur peut contresigner plus tard ou ailleurs. */
  @IsOptional()
  @IsString()
  @MaxLength(300_000)
  signatureBailleur?: string;
}
