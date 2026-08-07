import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * L'application n'a qu'un compte : le mot de passe est le seul identifiant, il
 * n'y a pas de champ email.
 */
export class LoginDto {
  /**
   * La borne haute est celle de bcrypt, qui ignore tout ce qui dépasse 72
   * octets : au-delà, la troncature serait silencieuse.
   */
  @IsString()
  @MinLength(8, { message: 'password doit contenir au moins 8 caractères' })
  @MaxLength(72, { message: 'password ne peut pas dépasser 72 caractères' })
  password!: string;
}
