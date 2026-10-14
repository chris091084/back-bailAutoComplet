import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Protège les routes par l'access token. Enregistré en guard GLOBAL (`APP_GUARD`
 * dans AuthModule) : toute route exige une session, sauf celles marquées
 * `@Public()`. Une route oubliée est donc fermée, et non ouverte.
 *
 * Reste utilisable explicitement avec `@UseGuards(JwtAuthGuard)` : c'est alors
 * redondant avec le guard global, mais sans effet de bord.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    return isPublic ? true : super.canActivate(context);
  }
}
