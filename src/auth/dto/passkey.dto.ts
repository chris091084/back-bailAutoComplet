import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Le corps `response` est la réponse brute de la cérémonie WebAuthn : sa forme est
 * vérifiée par la bibliothèque, pas par class-validator.
 */
export class PasskeyResponseDto {
  @IsObject()
  response!: Record<string, unknown>;
}

export class PasskeyRegistrationDto extends PasskeyResponseDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
