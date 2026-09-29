import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { CookieOptions, Request, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessCookieOptions,
  challengeCookieOptions,
  clearCookieOptions,
  refreshCookieOptions,
} from './auth.config';
import { AuthService, type TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PasskeyRegistrationDto, PasskeyResponseDto } from './dto/passkey.dto';
import { LoginThrottleService } from './login-throttle.service';
import {
  PASSKEY_PENDING_COOKIE,
  PASSKEY_REGISTRATION_COOKIE,
} from './passkey.config';
import { PasskeyService, type PasskeySummary } from './passkey.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

/** Réponse de `/auth/login` : soit connecté, soit en attente du passkey. */
type LoginResponse =
  | { authenticated: true }
  | {
      authenticated: false;
      passkeyRequired: true;
      options: PublicKeyCredentialRequestOptionsJSON;
    };

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
  constructor(
    private readonly authService: AuthService,
    private readonly passkeyService: PasskeyService,
    private readonly loginThrottle: LoginThrottleService,
  ) {}

  /**
   * Connexion par mot de passe : l'application n'a qu'un compte, il n'y a donc
   * pas d'inscription ni d'identifiant à fournir. Si des passkeys sont
   * enregistrés, la connexion se termine par `POST /auth/passkey/login`.
   *
   * Le mot de passe est semé hors ligne par `npm run auth:seed` : aucune route
   * HTTP ne permet de le définir ni de le modifier.
   */
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    await this.authService.validatePassword(dto);

    // Dès qu'un passkey est enregistré, le mot de passe ne suffit plus : aucun
    // cookie de session n'est posé avant la seconde étape.
    if (await this.passkeyService.hasPasskeys()) {
      const { options, challengeToken } =
        await this.passkeyService.beginAuthentication();

      response.cookie(
        PASSKEY_PENDING_COOKIE,
        challengeToken,
        challengeCookieOptions(),
      );

      return { authenticated: false, passkeyRequired: true, options };
    }

    await this.issueAndSetCookies(response);

    return { authenticated: true };
  }

  /**
   * Seconde étape de la connexion. Le cookie `passkey_pending` n'existe que si le
   * mot de passe vient d'être validé : il porte le défi que le passkey doit signer.
   */
  @Post('passkey/login')
  @HttpCode(200)
  async passkeyLogin(
    @Body() dto: PasskeyResponseDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ authenticated: true }> {
    this.loginThrottle.assertNotLocked();

    try {
      await this.passkeyService.finishAuthentication(
        request.cookies?.[PASSKEY_PENDING_COOKIE] as string | undefined,
        dto.response as unknown as AuthenticationResponseJSON,
      );
    } catch (error) {
      this.loginThrottle.registerFailure();
      throw error;
    }

    this.loginThrottle.reset();
    response.clearCookie(PASSKEY_PENDING_COOKIE, clearCookieOptions());
    await this.issueAndSetCookies(response);

    return { authenticated: true };
  }

  // --- Gestion des passkeys (session ouverte requise) ------------------------

  @Get('passkey')
  @UseGuards(JwtAuthGuard)
  listPasskeys(): Promise<PasskeySummary[]> {
    return this.passkeyService.list();
  }

  @Post('passkey/register/options')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async passkeyRegisterOptions(
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const { options, challengeToken } =
      await this.passkeyService.beginRegistration();

    response.cookie(
      PASSKEY_REGISTRATION_COOKIE,
      challengeToken,
      challengeCookieOptions(),
    );

    return options;
  }

  @Post('passkey/register/verify')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async passkeyRegisterVerify(
    @Body() dto: PasskeyRegistrationDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PasskeySummary> {
    const saved = await this.passkeyService.finishRegistration(
      request.cookies?.[PASSKEY_REGISTRATION_COOKIE] as string | undefined,
      dto.response as unknown as RegistrationResponseJSON,
      dto.label,
    );

    response.clearCookie(PASSKEY_REGISTRATION_COOKIE, clearCookieOptions());

    return saved;
  }

  @Delete('passkey/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async removePasskey(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.passkeyService.remove(id);
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
