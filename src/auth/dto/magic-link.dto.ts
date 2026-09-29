import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class MagicLinkRequestDto {
  @IsEmail({}, { message: 'email doit être une adresse valide' })
  @MaxLength(254, { message: 'email ne peut pas dépasser 254 caractères' })
  email!: string;
}

export class MagicLinkVerifyDto {
  /** 32 octets en base64url = 43 caractères ; les bornes laissent de la marge. */
  @IsString()
  @MinLength(20, { message: 'token invalide' })
  @MaxLength(200, { message: 'token invalide' })
  token!: string;
}
