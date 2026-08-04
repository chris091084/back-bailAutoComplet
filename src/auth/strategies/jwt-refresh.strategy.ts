import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { REFRESH_TOKEN_COOKIE, refreshTokenSecret } from '../auth.config';
import {
  AuthService,
  type AuthenticatedPrincipal,
  type JwtPayload,
} from '../auth.service';

const fromRefreshCookie = (request: Request): string | null =>
  (request.cookies as Record<string, string> | undefined)?.[
    REFRESH_TOKEN_COOKIE
  ] ?? null;

/**
 * Stratégie réservée à `POST /auth/refresh`. Elle valide la signature du refresh
 * token, puis délègue à l'AuthService la comparaison avec l'empreinte stockée en
 * base — c'est ce second contrôle qui rend le jeton révocable.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromRefreshCookie]),
      ignoreExpiration: false,
      secretOrKey: refreshTokenSecret(),
      passReqToCallback: true,
    });
  }

  async validate(
    request: Request,
    payload: JwtPayload,
  ): Promise<AuthenticatedPrincipal> {
    const refreshToken = fromRefreshCookie(request);

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    await this.authService.validateRefreshToken(refreshToken);

    return { sub: payload.sub };
  }
}
