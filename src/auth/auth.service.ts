import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { AuthAccount, SINGLE_ACCOUNT_ID } from './auth-account.entity';
import {
  accessTokenSecret,
  accessTokenTtlSeconds,
  refreshTokenSecret,
  refreshTokenTtlSeconds,
} from './auth.config';
import { LoginDto } from './dto/login.dto';
import { LoginThrottleService } from './login-throttle.service';

/**
 * Sujet des JWT. L'application n'ayant qu'un compte, il n'y a pas d'identifiant
 * à porter : la valeur est constante et donne simplement au jeton un `sub`
 * conforme.
 */
export const TOKEN_SUBJECT = 'owner';

export interface JwtPayload {
  sub: typeof TOKEN_SUBJECT;
}

/** Ce que les stratégies Passport déposent sur `request.user`. */
export interface AuthenticatedPrincipal {
  sub: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const BCRYPT_ROUNDS = 12;

/**
 * bcrypt ignore tout ce qui dépasse 72 octets. Un JWT en fait plusieurs
 * centaines, et deux refresh tokens successifs partagent leur en-tête et le
 * début de leur charge utile : les hacher directement reviendrait à comparer un
 * préfixe commun. On les réduit donc d'abord en SHA-256 (64 caractères hex, sous
 * la limite), ce qui fait dépendre le hash bcrypt du jeton entier.
 */
const digest = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Auth');

  constructor(
    @InjectRepository(AuthAccount)
    private readonly accountRepository: Repository<AuthAccount>,
    private readonly jwtService: JwtService,
    private readonly loginThrottle: LoginThrottleService,
  ) {}

  /**
   * Avertit à froid si le mot de passe n'a pas encore été semé : aucune route ne
   * permettant de le définir, l'API serait autrement inutilisable sans que rien
   * ne l'indique. Le message ne divulgue aucun secret.
   */
  async onApplicationBootstrap(): Promise<void> {
    const account = await this.accountRepository.findOne({
      where: { id: SINGLE_ACCOUNT_ID },
    });

    if (!account?.passwordHash) {
      this.logger.warn(
        "Aucun mot de passe en base : /auth/login refusera toute connexion. " +
          'Exécutez `npm run auth:seed` en local pour en définir un.',
      );
    }
  }

  /**
   * Compare le mot de passe fourni au hash stocké.
   *
   * bcrypt.compare travaille à temps constant pour un même coût, ce qui évite de
   * renseigner un attaquant sur la proximité de sa tentative.
   */
  async validatePassword(dto: LoginDto): Promise<void> {
    this.loginThrottle.assertNotLocked();

    const account = await this.requireAccount();

    if (!account.passwordHash) {
      // Même réponse que pour un mot de passe faux : signaler « non configuré »
      // renseignerait un attaquant sur l'état du déploiement. La trace reste
      // côté serveur, où seul l'exploitant la lit.
      this.logger.warn(
        'Tentative de connexion alors qu\'aucun mot de passe n\'est en base ' +
          '(`npm run auth:seed`).',
      );
      this.loginThrottle.registerFailure();
      throw new UnauthorizedException('Mot de passe incorrect');
    }

    if (!(await bcrypt.compare(dto.password, account.passwordHash))) {
      this.loginThrottle.registerFailure();
      throw new UnauthorizedException('Mot de passe incorrect');
    }

    this.loginThrottle.reset();
  }

  /**
   * Émet un couple de jetons et enregistre l'empreinte du refresh token.
   *
   * Un seul refresh token est valide à la fois : une nouvelle connexion, comme
   * une rotation, invalide le précédent.
   */
  async issueTokens(): Promise<TokenPair> {
    const payload: JwtPayload = { sub: TOKEN_SUBJECT };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessTokenSecret(),
        expiresIn: accessTokenTtlSeconds(),
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshTokenSecret(),
        expiresIn: refreshTokenTtlSeconds(),
      }),
    ]);

    await this.accountRepository.update(
      { id: SINGLE_ACCOUNT_ID },
      {
        refreshTokenHash: await bcrypt.hash(digest(refreshToken), BCRYPT_ROUNDS),
      },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Vérifie que le refresh token présenté est bien celui enregistré en base.
   *
   * La signature JWT a déjà été validée par la stratégie ; ce contrôle ajoute la
   * révocabilité : après un logout, ou après une rotation, l'empreinte stockée ne
   * correspond plus et le jeton — pourtant encore valide cryptographiquement —
   * est refusé.
   */
  async validateRefreshToken(refreshToken: string): Promise<void> {
    const account = await this.accountRepository.findOne({
      where: { id: SINGLE_ACCOUNT_ID },
    });

    if (!account?.refreshTokenHash) {
      throw new UnauthorizedException('Session expirée, reconnexion requise');
    }

    const matches = await bcrypt.compare(
      digest(refreshToken),
      account.refreshTokenHash,
    );

    if (!matches) {
      throw new UnauthorizedException('Session expirée, reconnexion requise');
    }
  }

  /** Révoque le refresh token enregistré ; les appels répétés sont sans effet. */
  async revokeRefreshToken(): Promise<void> {
    await this.accountRepository.update(
      { id: SINGLE_ACCOUNT_ID },
      { refreshTokenHash: null },
    );
  }

  private async requireAccount(): Promise<AuthAccount> {
    const account = await this.accountRepository.findOne({
      where: { id: SINGLE_ACCOUNT_ID },
    });

    if (!account) {
      throw new ConflictException(
        "Compte absent en base : la migration d'authentification n'a pas été appliquée",
      );
    }

    return account;
  }
}
