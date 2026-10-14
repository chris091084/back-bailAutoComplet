import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Exclut une route (ou un contrôleur entier) du guard global : elle reste
 * accessible sans session. À réserver à ce qui doit l'être avant toute
 * connexion (login, health check…) : toute autre route exige un access token.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
