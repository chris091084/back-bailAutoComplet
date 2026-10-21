import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ownerEmails } from '../auth/auth.config';
import { MailService } from '../mail/mail.service';
import {
  AncienLocataire,
  DELAI_CONSERVATION_ANNEES,
  purgerLocatairesSortis,
} from './locataire-purge';

/**
 * Le texte du rappel envoyé au propriétaire après une purge : la base est
 * nettoyée, mais les mails, SMS et papiers ne le sont pas, c'est à lui de s'en
 * occuper. Il porte les adresses à chercher, donc il se retrouve lui-même dans
 * cette recherche et part avec le reste.
 *
 * L'objet ne contient aucune donnée personnelle : il reste lisible dans la liste
 * des messages.
 */
export const OBJET_RAPPEL_PURGE =
  'Rappel RGPD : échanges à supprimer après purge';

export function composerRappelPurge(anciens: AncienLocataire[]): string {
  const lignes = anciens.map((ancien) => {
    const adresses = ancien.emails.length
      ? ancien.emails.join(', ')
      : 'aucune adresse enregistrée';
    const sortie = ancien.sortie ? `, sortie le ${ancien.sortie}` : '';
    return `- ${ancien.prenom} ${ancien.nom} : ${adresses}${sortie}`;
  });

  return [
    'Bonjour,',
    '',
    `La purge automatique vient de supprimer de l'application ${anciens.length} ancien(s) locataire(s), sortis depuis plus de ${DELAI_CONSERVATION_ANNEES} ans :`,
    '',
    ...lignes,
    '',
    'Il reste à supprimer à la main leurs échanges :',
    '1. Dans Gmail, cherche chaque adresse ci-dessus : cela retrouve les mails envoyés et reçus.',
    '2. Sélectionne tout, supprime, puis vide la Corbeille.',
    '3. Pense aussi aux SMS, à WhatsApp et aux papiers.',
    '',
    'Ce message contient ces adresses : il apparaîtra dans ta recherche, supprime-le avec le reste.',
  ].join('\n');
}

/**
 * Lance la purge RGPD au démarrage de l'API, quand `PURGE_LOCATAIRES=true`.
 *
 * Pas de planificateur (cron) : l'hébergeur met le conteneur à l'échelle zéro,
 * un minuteur interne ne tournerait pas pendant son sommeil. Le démarrage, lui,
 * a lieu à chaque réveil, et la purge est sans effet quand rien n'est échu :
 * une simple requête de lecture. Elle ne bloque pas le démarrage.
 *
 * Désactivée par défaut : une suppression est définitive, on l'active en
 * connaissance de cause (voir `npm run purge:locataires` pour l'essai à blanc).
 */
@Injectable()
export class LocatairePurgeService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LocatairePurgeService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('PURGE_LOCATAIRES')?.toLowerCase() !== 'true') {
      return;
    }

    void this.purger();
  }

  private async purger(): Promise<void> {
    try {
      const bilan = await purgerLocatairesSortis(this.dataSource, {
        executer: true,
      });

      if (bilan.locataires > 0) {
        this.logger.log(
          `Purge RGPD (sortis depuis plus de ${DELAI_CONSERVATION_ANNEES} ans) : ` +
            `${bilan.locataires} locataire(s), ${bilan.baux} bail(s), ` +
            `${bilan.generations} génération(s) supprimé(s)`,
        );
        await this.envoyerRappel(bilan.anciens);
      }
    } catch (error) {
      this.logger.error(
        'Échec de la purge RGPD des locataires',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Envoyé APRÈS la suppression, aux adresses des propriétaires, sans la copie
   * cachée d'archivage (elle garderait une trace de plus des adresses effacées).
   * Un échec n'annule rien : la purge est faite, il est seulement journalisé,
   * sans aucune donnée personnelle.
   */
  private async envoyerRappel(anciens: AncienLocataire[]): Promise<void> {
    const destinataires = ownerEmails();

    if (destinataires.length === 0) {
      this.logger.warn(
        'Purge faite, mais AUTH_OWNER_EMAIL est absent : aucun rappel envoyé.',
      );
      return;
    }

    try {
      await this.mail.envoyer({
        to: destinataires.join(', '),
        subject: OBJET_RAPPEL_PURGE,
        text: composerRappelPurge(anciens),
        sansCopie: true,
      });
    } catch {
      this.logger.warn(
        "Purge faite, mais le rappel de suppression des échanges n'a pas pu partir.",
      );
    }
  }
}
