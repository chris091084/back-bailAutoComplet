import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_COOKIE, accessTokenSecret } from '../auth.config';
import type { AuthenticatedPrincipal, JwtPayload } from '../auth.service';

/**
 * Les jetons ne circulant que par cookie httpOnly, l'extraction ne regarde pas
 * l'en-tête `Authorization`.
 */
const fromAccessCookie = (request: Request): string | null =>
  (request.cookies as Record<string, string> | undefined)?.[
    ACCESS_TOKEN_COOKIE
  ] ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromAccessCookie]),
      ignoreExpiration: false,
      secretOrKey: accessTokenSecret(),
    });
  }

  /**
   * Signature et expiration validées en amont par passport-jwt. Avec un compte
   * unique il n'y a rien à relire en base : un access token valide suffit.
   */
  validate(payload: JwtPayload): AuthenticatedPrincipal {
    return { sub: payload.sub };
  }
}
