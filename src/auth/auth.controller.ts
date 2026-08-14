import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessCookieOptions,
  clearCookieOptions,
  refreshCookieOptions,
} from './auth.config';
import { AuthService, type TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

/**
 * La validation est posée ici plutôt qu'en pipe global : les DTO des modules
 * historiques (appartement, chambre…) n'ont aucun décorateur, un `whitelist`
 * global viderait leurs corps de requête.
 */
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Connexion par mot de passe seul : l'application n'a qu'un compte, il n'y a
   * donc pas d'inscription ni d'identifiant à fournir.
   *
   * Le mot de passe est semé hors ligne par `npm run auth:seed` : aucune route
   * HTTP ne permet de le définir ni de le modifier.
   */
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ authenticated: true }> {
    await this.authService.validatePassword(dto);
    await this.issueAndSetCookies(response);

    return { authenticated: true };
  }

  /**
   * Renouvellement. Les deux jetons sont réémis : le refresh token est tourné à
   * chaque usage, si bien qu'un jeton intercepté cesse de valoir dès que le
   * client légitime s'en sert.
   */
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ authenticated: true }> {
    await this.issueAndSetCookies(response);

    return { authenticated: true };
  }

  /**
   * Déconnexion. Volontairement non protégée par JwtAuthGuard : un access token
   * expiré ne doit pas empêcher de se déconnecter. La session est révoquée en
   * base et les cookies effacés dans tous les cas — l'appel réussit donc même
   * sans session ouverte.
   */
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ authenticated: false }> {
    await this.authService.revokeRefreshToken();

    const options: CookieOptions = clearCookieOptions();
    response.clearCookie(ACCESS_TOKEN_COOKIE, options);
    response.clearCookie(REFRESH_TOKEN_COOKIE, options);

    return { authenticated: false };
  }

  /**
   * Vérification de session : 200 si l'access token est valide, 401 sinon. Sert
   * au front à décider s'il doit tenter un refresh ou renvoyer vers le login.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(): { authenticated: true } {
    return { authenticated: true };
  }

  private async issueAndSetCookies(response: Response): Promise<void> {
    const { accessToken, refreshToken }: TokenPair =
      await this.authService.issueTokens();

    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessCookieOptions());
    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions());
  }
}
