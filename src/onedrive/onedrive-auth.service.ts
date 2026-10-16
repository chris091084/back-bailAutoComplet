import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { chiffrer, dechiffrer } from '../common/chiffrement';
import { OneDriveIndisponibleError } from './onedrive.errors';
import {
  ONEDRIVE_CONNEXION_ID,
  OneDriveConnexion,
} from './onedrive-connexion.entity';
import {
  SCOPES,
  URL_AUTORISATION,
  URL_JETON,
  cleChiffrement,
  configOneDrive,
  onedriveConfigure,
} from './onedrive.config';
import { StatutOneDrive } from './onedrive.types';

/** Marge avant l'expiration réelle : on renouvelle un peu tôt plutôt que de se faire refuser. */
const MARGE_EXPIRATION_MS = 60_000;
const DELAI_REQUETE_MS = 15_000;
const VALIDITE_STATE_S = 10 * 60;
const AUDIENCE_STATE = 'onedrive-connexion';

interface ReponseJeton {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/**
 * Flux OAuth « délégué » vers le OneDrive personnel du bailleur.
 *
 *   1. le bailleur clique « Connecter OneDrive » ─► `urlAutorisation()`
 *   2. Microsoft lui demande son accord, puis le renvoie sur `/onedrive/callback`
 *   3. `connecterAvecCode()` échange le code contre access + refresh token ;
 *      le refresh token est CHIFFRÉ puis stocké. Une seule fois.
 *   4. ensuite `accessToken()` renouvelle l'access token (1 h) à la demande,
 *      avec un cache mémoire jusqu'à son expiration.
 */
@Injectable()
export class OneDriveAuthService {
  private readonly logger = new Logger('OneDrive');

  private accessTokenCache: { valeur: string; expireA: number } | null = null;
  /** Un seul renouvellement à la fois : Microsoft fait tourner le refresh token. */
  private renouvellementEnCours: Promise<string> | null = null;

  constructor(
    @InjectRepository(OneDriveConnexion)
    private readonly repository: Repository<OneDriveConnexion>,
    private readonly jwt: JwtService,
  ) {}

  async statut(): Promise<StatutOneDrive> {
    const connexion = await this.repository.findOneBy({
      id: ONEDRIVE_CONNEXION_ID,
    });

    return {
      configure: onedriveConfigure(),
      connecte: connexion?.statut === 'connecte',
      revoque: connexion?.statut === 'revoque',
      connecteLe: connexion?.connecteLe.toISOString() ?? null,
    };
  }

  /**
   * URL de la page de consentement Microsoft. Le `state` est un jeton signé de
   * 10 minutes : au retour, il prouve que la demande part bien d'ici (parade au
   * CSRF — quelqu'un qui forgerait un lien de retour pour brancher SON compte).
   */
  async urlAutorisation(): Promise<string> {
    const { clientId, redirectUri } = configOneDrive();
    const state = await this.jwt.signAsync(
      { nonce: randomUUID() },
      {
        secret: cleStateSecret(),
        audience: AUDIENCE_STATE,
        expiresIn: VALIDITE_STATE_S,
      },
    );

    const parametres = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: SCOPES,
      state,
    });

    return `${URL_AUTORISATION()}?${parametres.toString()}`;
  }

  /** Retour de Microsoft : valide le `state`, échange le code, stocke le refresh token chiffré. */
  async connecterAvecCode(code: string, state: string): Promise<void> {
    try {
      await this.jwt.verifyAsync(state, {
        secret: cleStateSecret(),
        audience: AUDIENCE_STATE,
      });
    } catch {
      throw new BadRequestException(
        'Demande de connexion expirée ou invalide.',
      );
    }

    const { clientId, clientSecret, redirectUri } = configOneDrive();
    const reponse = await this.appelerJeton({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      scope: SCOPES,
    });

    if (!reponse.refresh_token || !reponse.access_token) {
      throw new BadRequestException(
        "Microsoft n'a pas renvoyé de jeton de renouvellement (scope offline_access refusé ?).",
      );
    }

    await this.enregistrerRefreshToken(reponse.refresh_token, 'connecte');
    this.memoriser(reponse);
    this.logger.log('OneDrive connecté');
  }

  async deconnecter(): Promise<void> {
    await this.repository.delete({ id: ONEDRIVE_CONNEXION_ID });
    this.accessTokenCache = null;
    this.logger.log('OneDrive déconnecté');
  }

  /** Access token valable, depuis le cache ou après renouvellement. */
  async accessToken(): Promise<string> {
    if (
      this.accessTokenCache &&
      this.accessTokenCache.expireA - MARGE_EXPIRATION_MS > Date.now()
    ) {
      return this.accessTokenCache.valeur;
    }

    this.renouvellementEnCours ??= this.renouveler().finally(() => {
      this.renouvellementEnCours = null;
    });

    return this.renouvellementEnCours;
  }

  /** Oublie l'access token en cache (Graph l'a refusé : il a pu être révoqué plus tôt). */
  invalider(): void {
    this.accessTokenCache = null;
  }

  // ----------------------------------------------------------------- interne

  private async renouveler(): Promise<string> {
    if (!onedriveConfigure()) {
      throw new OneDriveIndisponibleError(
        'NON_CONFIGURE',
        "OneDrive n'est pas configuré sur le serveur.",
      );
    }

    const connexion = await this.repository.findOneBy({
      id: ONEDRIVE_CONNEXION_ID,
    });
    if (!connexion) {
      throw new OneDriveIndisponibleError(
        'NON_CONNECTE',
        "OneDrive n'est pas connecté : le bailleur doit le connecter depuis la page d'administration.",
      );
    }
    if (connexion.statut === 'revoque') {
      throw new OneDriveIndisponibleError(
        'REVOQUE',
        "L'accès à OneDrive a été retiré : reconnectez-le depuis la page d'administration.",
      );
    }

    const { clientId, clientSecret } = configOneDrive();
    const refreshToken = dechiffrer(
      connexion.refreshTokenChiffre,
      cleChiffrement(),
    );

    let reponse: ReponseJeton;
    try {
      reponse = await this.appelerJeton({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: SCOPES,
      });
    } catch (erreur) {
      if (
        erreur instanceof OneDriveIndisponibleError &&
        erreur.cause_ === 'REVOQUE'
      ) {
        // Définitif tant que le bailleur ne se reconnecte pas : on s'en souvient
        // pour ne pas marteler Microsoft à chaque photo.
        await this.repository.update(
          { id: ONEDRIVE_CONNEXION_ID },
          { statut: 'revoque', updatedAt: new Date() },
        );
        this.accessTokenCache = null;
        this.logger.warn('Accès OneDrive révoqué : reconnexion nécessaire');
      }
      throw erreur;
    }

    if (!reponse.access_token) {
      throw new OneDriveIndisponibleError(
        'INDISPONIBLE',
        'Réponse inattendue de Microsoft.',
      );
    }

    // Microsoft renvoie parfois un NOUVEAU refresh token (rotation) : on garde le plus récent.
    if (reponse.refresh_token && reponse.refresh_token !== refreshToken) {
      await this.enregistrerRefreshToken(
        reponse.refresh_token,
        'connecte',
        false,
      );
    }

    return this.memoriser(reponse);
  }

  private memoriser(reponse: ReponseJeton): string {
    const valeur = reponse.access_token as string;
    this.accessTokenCache = {
      valeur,
      expireA: Date.now() + (reponse.expires_in ?? 3600) * 1000,
    };
    return valeur;
  }

  private async enregistrerRefreshToken(
    refreshToken: string,
    statut: 'connecte' | 'revoque',
    nouvelleConnexion = true,
  ): Promise<void> {
    const maintenant = new Date();
    const chiffre = chiffrer(refreshToken, cleChiffrement());

    if (nouvelleConnexion) {
      await this.repository.save({
        id: ONEDRIVE_CONNEXION_ID,
        refreshTokenChiffre: chiffre,
        statut,
        connecteLe: maintenant,
        updatedAt: maintenant,
      });
    } else {
      await this.repository.update(
        { id: ONEDRIVE_CONNEXION_ID },
        { refreshTokenChiffre: chiffre, statut, updatedAt: maintenant },
      );
    }
  }

  /** POST du jeton. Ne journalise ni le corps envoyé (secrets) ni celui reçu (jetons). */
  private async appelerJeton(
    corps: Record<string, string>,
  ): Promise<ReponseJeton> {
    let reponse: Response;
    try {
      reponse = await fetch(URL_JETON(), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(corps),
        signal: AbortSignal.timeout(DELAI_REQUETE_MS),
      });
    } catch {
      throw new OneDriveIndisponibleError(
        'INDISPONIBLE',
        'Microsoft est injoignable.',
      );
    }

    const donnees = (await reponse.json().catch(() => ({}))) as ReponseJeton;

    if (reponse.ok) {
      return donnees;
    }

    if (
      donnees.error === 'invalid_grant' ||
      donnees.error === 'interaction_required'
    ) {
      throw new OneDriveIndisponibleError(
        'REVOQUE',
        "L'accès à OneDrive a été retiré : reconnectez-le depuis la page d'administration.",
      );
    }
    if (reponse.status === 429) {
      throw new OneDriveIndisponibleError(
        'LIMITE',
        'Microsoft limite temporairement les requêtes.',
        lireRetryAfter(reponse),
      );
    }
    if (reponse.status >= 500) {
      throw new OneDriveIndisponibleError(
        'INDISPONIBLE',
        'Microsoft rencontre un problème.',
        lireRetryAfter(reponse),
      );
    }

    // 4xx autre (client_secret faux, redirect_uri différent…) : erreur de configuration.
    this.logger.error(
      `Échange de jeton refusé par Microsoft (${reponse.status} ${donnees.error ?? ''})`,
    );
    throw new OneDriveIndisponibleError(
      'NON_CONFIGURE',
      'Microsoft a refusé la configuration OneDrive (identifiants ou adresse de retour).',
    );
  }
}

/** `Retry-After` en secondes (la forme « date HTTP » est rare chez Graph, ignorée). */
export function lireRetryAfter(reponse: Response): number | undefined {
  const brut = Number(reponse.headers.get('retry-after'));
  return Number.isFinite(brut) && brut > 0 ? brut : undefined;
}

/**
 * Clé de signature du `state`, DÉRIVÉE de la clé de chiffrement par HMAC avec un
 * libellé : une même clé ne sert ainsi jamais à deux usages différents (AES-GCM
 * d'un côté, signature JWT de l'autre).
 */
function cleStateSecret(): string {
  return createHmac('sha256', cleChiffrement())
    .update('onedrive-state-v1')
    .digest('base64');
}
