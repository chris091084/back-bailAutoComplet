import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
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
import { MagicLinkRequestDto, MagicLinkVerifyDto } from './dto/magic-link.dto';
import { PasskeyRegistrationDto, PasskeyResponseDto } from './dto/passkey.dto';
import { LoginThrottleService } from './login-throttle.service';
import { MagicLinkService } from './magic-link.service';
import {
  PASSKEY_PENDING_COOKIE,
  PASSKEY_REGISTRATION_COOKIE,
} from './passkey.config';
import { PasskeyService, type PasskeySummary } from './passkey.service';
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
  constructor(
    private readonly authService: AuthService,
    private readonly passkeyService: PasskeyService,
    private readonly loginThrottle: LoginThrottleService,
    private readonly magicLink: MagicLinkService,
  ) {}

  /**
   * Moyens de connexion disponibles, pour que le front n'affiche que ceux qui
   * marchent. Public : ces deux booléens ne révèlent rien d'exploitable.
   */
  @Get('methods')
  async methods(): Promise<{ passkey: boolean; magicLink: boolean }> {
    return {
      passkey: await this.passkeyService.hasPasskeys(),
      magicLink: this.magicLink.isEnabled(),
    };
  }

  /**
   * Connexion par mot de passe : l'application n'a qu'un compte, il n'y a donc
   * pas d'inscription ni d'identifiant à fournir.
   *
   * Ce n'est que l'amorçage : dès qu'un passkey est enregistré, le mot de passe
   * n'ouvre plus de session (le passkey le remplace, il ne s'y ajoute pas). Le
   * recours en cas de perte est le lien envoyé par email.
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
    if (await this.passkeyService.hasPasskeys()) {
      throw new ForbiddenException(
        'Connexion par mot de passe désactivée : utilisez votre passkey ou le lien reçu par email',
      );
    }

    await this.authService.validatePassword(dto);
    await this.issueAndSetCookies(response);

    return { authenticated: true };
  }

  /**
   * Première étape de la connexion par passkey : fournit le défi à signer. Le
   * cookie `passkey_pending` le porte jusqu'à `POST /auth/passkey/login`.
   */
  @Post('passkey/login/options')
  @HttpCode(200)
  async passkeyLoginOptions(
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    this.loginThrottle.assertNotLocked();

    if (!(await this.passkeyService.hasPasskeys())) {
      throw new NotFoundException('Aucun passkey enregistré');
    }

    const { options, challengeToken } =
      await this.passkeyService.beginAuthentication();

    response.cookie(
      PASSKEY_PENDING_COOKIE,
      challengeToken,
      challengeCookieOptions(),
    );

    return options;
  }

  /**
   * Demande d'un lien de connexion. La réponse est toujours la même : elle ne
   * doit pas indiquer si l'adresse saisie est celle du propriétaire.
   */
  @Post('magic-link')
  @HttpCode(200)
  async requestMagicLink(
    @Body() dto: MagicLinkRequestDto,
  ): Promise<{ sent: true }> {
    await this.magicLink.request(dto.email);

    return { sent: true };
  }

  /** Consomme le lien reçu par email et ouvre la session. */
  @Post('magic-link/verify')
  @HttpCode(200)
  async verifyMagicLink(
    @Body() dto: MagicLinkVerifyDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ authenticated: true }> {
    await this.magicLink.consume(dto.token);
    await this.issueAndSetCookies(response);

    return { authenticated: true };
  }

  /**
   * Seconde étape de la connexion par passkey. Le cookie `passkey_pending` n'existe
   * que si `passkey/login/options` vient d'être appelé : il porte le défi à signer.
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
