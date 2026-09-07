import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { SendMailDto } from './dto/send-mail.dto';

/** Pièce jointe déjà sous forme binaire, telle que le serveur la produit. */
export interface PieceJointe {
  filename: string;
  content: Buffer;
}

export interface MessageMail {
  to: string;
  subject: string;
  text: string;
  /** Corps mis en forme ; `text` reste le repli des clients sans HTML. */
  html?: string;
  attachments?: PieceJointe[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  /**
   * Créé à la première demande, puis conservé : nodemailer réutilise la
   * connexion SMTP d'un envoi à l'autre. Reste `null` tant qu'aucun mail n'a
   * été envoyé, pour que l'API démarre même sans configuration SMTP.
   */
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Envoi depuis le navigateur, pièces jointes encodées en base64. */
  async sendMail(payload: SendMailDto): Promise<void> {
    await this.envoyer({
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: payload.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.contentBase64, 'base64'),
      })),
    });
  }

  async envoyer(message: MessageMail): Promise<void> {
    const transporter = this.getTransporter();
    // Gmail refuse d'expédier au nom d'une autre adresse que celle
    // authentifiée : à défaut de MAIL_FROM, on reprend MAIL_USER.
    const from =
      this.config.get<string>('MAIL_FROM') ??
      this.config.get<string>('MAIL_USER');
    // Copie cachée systématique (archivage). Décidée ici et non par le front :
    // le navigateur ne doit pas pouvoir la retirer. Vide = pas de copie.
    const bcc = this.config.get<string>('MAIL_BCC')?.trim() || undefined;

    try {
      await transporter.sendMail({
        from,
        to: message.to,
        bcc,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      });
    } catch (error) {
      // Le détail (identifiants, hôte) ne doit pas remonter au navigateur.
      this.logger.error(
        `Échec de l'envoi du mail à ${message.to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        "L'envoi du mail a échoué. Vérifiez la configuration SMTP.",
      );
    }

    // Sans cette trace, les logs ne permettent pas de dire si un mail est
    // parti : seules les conversions et les échecs y apparaissaient.
    this.logger.log(
      `Mail envoyé à ${message.to} (${message.attachments?.length ?? 0} pièce(s) jointe(s))`,
    );
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.config.get<string>('MAIL_HOST');
    if (!host) {
      // Message explicite plutôt qu'un plantage obscur de nodemailer sur un
      // hôte `undefined`.
      throw new InternalServerErrorException(
        "L'envoi de mail n'est pas configuré : renseignez MAIL_HOST, MAIL_PORT, MAIL_USER et MAIL_PASSWORD.",
      );
    }

    const port = Number(this.config.get<string>('MAIL_PORT') ?? 587);
    const user = this.config.get<string>('MAIL_USER');
    // Les mots de passe d'application Google sont affichés par groupes de
    // quatre : les espaces sont décoratifs et font échouer l'authentification.
    const pass = this.config.get<string>('MAIL_PASSWORD')?.replace(/\s/g, '');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      // Implicite sur 465, STARTTLS ailleurs — surchargeable par MAIL_SECURE.
      secure: this.config.get<string>('MAIL_SECURE') === 'true' || port === 465,
      auth: user ? { user, pass } : undefined,
    });

    return this.transporter;
  }
}
