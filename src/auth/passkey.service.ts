import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { Repository } from 'typeorm';
import { accessTokenSecret } from './auth.config';
import { PasskeyCredential } from './passkey-credential.entity';
import {
  PASSKEY_CHALLENGE_TTL_SECONDS,
  webauthnOrigin,
  webauthnRpId,
  webauthnRpName,
} from './passkey.config';

type ChallengePurpose = 'passkey-login' | 'passkey-register';

interface ChallengePayload {
  purpose: ChallengePurpose;
  challenge: string;
}

/** Identifiant WebAuthn du compte : constant, l'application n'en a qu'un. */
const USER_HANDLE = Buffer.from('bail-auto-owner');

export interface PasskeySummary {
  id: number;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/**
 * Passkeys utilisés comme second facteur, après le mot de passe.
 *
 * Le défi WebAuthn voyage dans un jeton signé et à durée courte, posé en cookie
 * httpOnly : aucun état serveur, donc compatible avec un déploiement serverless
 * multi-instances. Le jeton porte un `purpose` pour qu'un défi d'enregistrement
 * ne puisse pas servir à une connexion, et inversement.
 */
@Injectable()
export class PasskeyService {
  constructor(
    @InjectRepository(PasskeyCredential)
    private readonly credentials: Repository<PasskeyCredential>,
    private readonly jwtService: JwtService,
  ) {}

  async hasPasskeys(): Promise<boolean> {
    return (await this.credentials.count()) > 0;
  }

  async list(): Promise<PasskeySummary[]> {
    const rows = await this.credentials.find({ order: { createdAt: 'ASC' } });

    return rows.map(({ id, label, createdAt, lastUsedAt }) => ({
      id,
      label,
      createdAt,
      lastUsedAt,
    }));
  }

  async remove(id: number): Promise<void> {
    const result = await this.credentials.delete({ id });

    if (!result.affected) {
      throw new NotFoundException('Passkey introuvable');
    }
  }

  /** Supprime tous les passkeys : utilisé par `npm run auth:reset-passkeys`. */
  async removeAll(): Promise<void> {
    await this.credentials.clear();
  }

  // --- Enregistrement (session ouverte requise) ------------------------------

  async beginRegistration(): Promise<{
    options: PublicKeyCredentialCreationOptionsJSON;
    challengeToken: string;
  }> {
    const existing = await this.credentials.find();

    const options = await generateRegistrationOptions({
      rpName: webauthnRpName(),
      rpID: webauthnRpId(),
      userName: 'owner',
      userID: USER_HANDLE,
      attestationType: 'none',
      // Un authentificateur déjà enregistré ne doit pas l'être deux fois.
      excludeCredentials: existing.map((credential) => ({
        id: credential.credentialId,
        transports: this.parseTransports(credential.transports),
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    return {
      options,
      challengeToken: await this.signChallenge('passkey-register', options.challenge),
    };
  }

  async finishRegistration(
    challengeToken: string | undefined,
    response: RegistrationResponseJSON,
    label: string | undefined,
  ): Promise<PasskeySummary> {
    const challenge = await this.readChallenge(challengeToken, 'passkey-register');

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: webauthnOrigin(),
      expectedRPID: webauthnRpId(),
      requireUserVerification: false,
    }).catch(() => {
      throw new BadRequestException("L'enregistrement du passkey a échoué");
    });

    if (!verification.verified) {
      throw new BadRequestException("L'enregistrement du passkey a échoué");
    }

    const { credential } = verification.registrationInfo;

    const saved = await this.credentials.save(
      this.credentials.create({
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports?.join(',') ?? null,
        label: label?.trim() || 'Passkey',
        lastUsedAt: null,
      }),
    );

    return {
      id: saved.id,
      label: saved.label,
      createdAt: saved.createdAt,
      lastUsedAt: saved.lastUsedAt,
    };
  }

  // --- Connexion (second facteur, après le mot de passe) ---------------------

  async beginAuthentication(): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challengeToken: string;
  }> {
    const existing = await this.credentials.find();

    const options = await generateAuthenticationOptions({
      rpID: webauthnRpId(),
      allowCredentials: existing.map((credential) => ({
        id: credential.credentialId,
        transports: this.parseTransports(credential.transports),
      })),
      userVerification: 'preferred',
    });

    return {
      options,
      challengeToken: await this.signChallenge('passkey-login', options.challenge),
    };
  }

  /** Lève 401 si la signature, le défi, l'origine ou le compteur ne collent pas. */
  async finishAuthentication(
    challengeToken: string | undefined,
    response: AuthenticationResponseJSON,
  ): Promise<void> {
    const challenge = await this.readChallenge(challengeToken, 'passkey-login');

    const stored = await this.credentials.findOne({
      where: { credentialId: response.id },
    });

    if (!stored) {
      throw new UnauthorizedException('Passkey non reconnu');
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: webauthnOrigin(),
      expectedRPID: webauthnRpId(),
      credential: {
        id: stored.credentialId,
        publicKey: new Uint8Array(stored.publicKey),
        counter: stored.counter,
        transports: this.parseTransports(stored.transports),
      },
      // Le mot de passe est déjà le premier facteur : la vérification biométrique
      // ou par PIN n'est pas imposée, pour ne pas exclure les clés sans PIN.
      requireUserVerification: false,
    }).catch(() => {
      throw new UnauthorizedException('Vérification du passkey échouée');
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Vérification du passkey échouée');
    }

    await this.credentials.update(
      { id: stored.id },
      {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    );
  }

  // --- Défis signés ----------------------------------------------------------

  private signChallenge(
    purpose: ChallengePurpose,
    challenge: string,
  ): Promise<string> {
    const payload: ChallengePayload = { purpose, challenge };

    return this.jwtService.signAsync(payload, {
      secret: this.challengeSecret(),
      expiresIn: PASSKEY_CHALLENGE_TTL_SECONDS,
    });
  }

  private async readChallenge(
    token: string | undefined,
    purpose: ChallengePurpose,
  ): Promise<string> {
    if (!token) {
      throw new UnauthorizedException('Défi WebAuthn absent ou expiré');
    }

    try {
      const payload = await this.jwtService.verifyAsync<ChallengePayload>(token, {
        secret: this.challengeSecret(),
      });

      if (payload.purpose !== purpose) {
        throw new Error('purpose');
      }

      return payload.challenge;
    } catch {
      throw new UnauthorizedException('Défi WebAuthn absent ou expiré');
    }
  }

  /** Clé dérivée : distincte de celle des access tokens, sans nouvelle variable. */
  private challengeSecret(): string {
    return `${accessTokenSecret()}:webauthn-challenge`;
  }

  private parseTransports(
    raw: string | null,
  ): AuthenticatorTransport[] | undefined {
    return raw ? (raw.split(',') as AuthenticatorTransport[]) : undefined;
  }
}
