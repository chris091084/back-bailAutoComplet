import { InternalServerErrorException } from '@nestjs/common';
import type { MessageMail } from '../src/mail/mail.service';

/** Boîte d'envoi de pacotille : garde les messages, sans aucun SMTP. */
export class CourrierFaux {
  readonly messages: MessageMail[] = [];
  /** Adresse pour laquelle l'envoi échoue, le temps d'un test. */
  echecPour: string | null = null;

  async envoyer(message: MessageMail): Promise<void> {
    if (message.to === this.echecPour) {
      throw new InternalServerErrorException("L'envoi du mail a échoué.");
    }
    this.messages.push(message);
  }
}
