import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Réservé à `POST /auth/refresh` : lit le cookie `refresh_token`. */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
