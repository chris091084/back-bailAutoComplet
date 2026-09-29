import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { AuthAccount, SINGLE_ACCOUNT_ID } from './auth-account.entity';
import { ownerEmail } from './auth.config';
import { webauthnOrigin } from './passkey.config';

/** Validité d'un lien : assez court pour limiter l'exposition d'une boîte mail lue tard. */
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

/** Délai minimal entre deux envois : freine le mail-bombing de la boîte du propriétaire. */
const MIN_INTERVAL_MS = 60 * 1000;

const digest = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Comparaison à temps constant, insensible à la casse et aux espaces autour. */
const sameEmail = (candidate: string, expected: string): boolean => {
  const a = Buffer.from(candidate.trim().toLowerCase());
  const b = Buffer.from(expected.trim().toLowerCase());

  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Connexion par lien envoyé par email, réservée à l'adresse `AUTH_OWNER_EMAIL`.
 *
 * C'est la liste blanche : n'importe qui peut demander un lien, mais seule
 * l'adresse du propriétaire en reçoit un, et la réponse est identique dans tous
 * les cas pour ne pas révéler laquelle est autorisée. Le lien sert à ouvrir une
 * session quand on n'a pas (ou plus) de passkey, typiquement pour en enregistrer
 * un premier ou en remplacer un perdu.
 */
@Injectable()
export class MagicLinkService {
  private readonly logger = new Logger('MagicLink');

  /** En mémoire : suffisant en mono-instance, comme l'anti-force brute. */
  private lastSentAt = 0;

  constructor(
    @InjectRepository(AuthAccount)
    private readonly accounts: Repository<AuthAccount>,
    private readonly mail: MailService,
  ) {}

  /** Indique si la fonctionnalité est utilisable, pour que le front masque le bouton sinon. */
  isEnabled(): boolean {
    return Boolean(ownerEmail());
  }

  /**
   * Ne lève jamais d'erreur liée à l'adresse ou au SMTP : un 4xx/5xx différencié
   * dirait à un tiers quelle adresse est la bonne. Les échecs vont dans les logs.
   */
  async request(email: string): Promise<void> {
    const owner = ownerEmail();

    if (!owner) {
      this.logger.warn(
        'Lien magique demandé mais AUTH_OWNER_EMAIL est absent : rien envoyé.',
      );
      return;
    }

    if (!sameEmail(email, owner)) {
      return;
    }

    const now = Date.now();

    if (now - this.lastSentAt < MIN_INTERVAL_MS) {
      this.logger.warn('Lien magique redemandé trop tôt : ignoré.');
      return;
    }

    // 256 bits d'aléa : impossible à deviner, donc pas besoin d'anti-force brute.
    const token = randomBytes(32).toString('base64url');

    await this.accounts.update(
      { id: SINGLE_ACCOUNT_ID },
      {
        magicLinkHash: digest(token),
        magicLinkExpiresAt: new Date(now + MAGIC_LINK_TTL_MS),
      },
    );

    // Dans le fragment (#) et non dans la query : il n'est ni envoyé au serveur
    // du front, ni consigné dans ses logs, ni transmis en en-tête Referer.
    const link = `${webauthnOrigin()}/login/magic#token=${token}`;

    try {
      await this.mail.envoyer({
        // L'adresse configurée, jamais celle saisie : la casse ou un alias saisi
        // ne doivent pas changer le destinataire.
        to: owner,
        subject: 'Votre lien de connexion Bail Auto',
        text:
          `Voici votre lien de connexion (valable ${MAGIC_LINK_TTL_MS / 60000} minutes, ` +
          `utilisable une seule fois) :\n\n${link}\n\n` +
          "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
        // Ce mail porte un secret : pas de copie cachée d'archivage.
        sansCopie: true,
      });
      this.lastSentAt = now;
    } catch (error) {
      this.logger.error(
        "Échec de l'envoi du lien magique",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Consomme le lien : la mise à jour conditionnelle est atomique, donc deux
   * requêtes simultanées avec le même jeton ne peuvent pas réussir toutes les deux.
   */
  async consume(token: string): Promise<void> {
    const result = await this.accounts
      .createQueryBuilder()
      .update(AuthAccount)
      .set({ magicLinkHash: null, magicLinkExpiresAt: null })
      .where('id = :id', { id: SINGLE_ACCOUNT_ID })
      .andWhere('magic_link_hash = :hash', { hash: digest(token) })
      .andWhere('magic_link_expires_at > :now', { now: new Date() })
      .execute();

    if (!result.affected) {
      throw new UnauthorizedException('Lien invalide, expiré ou déjà utilisé');
    }
  }
}
