import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protège n'importe quelle route par l'access token : `@UseGuards(JwtAuthGuard)`
 * sur un contrôleur ou une méthode. Le compte authentifié est ensuite disponible
 * via `@CurrentUser()`.
 *
 * Utilisable ailleurs dans l'application à condition que le module concerné
 * importe AuthModule (qui enregistre la stratégie `jwt`).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
