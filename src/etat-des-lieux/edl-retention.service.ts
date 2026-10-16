import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { OneDriveService } from '../onedrive/onedrive.service';
import {
  PURGE_LIMITE_PAR_PASSAGE,
  anneesConservation,
  purgeAutomatiqueActive,
} from './edl-retention.config';
import { EtatDesLieux } from './etat-des-lieux.entity';

export interface ResultatEffacement {
  documentsSupprimes: number;
  fichiersSupprimes: number;
  /** Documents CONSERVÉS parce qu'un de leurs fichiers n'a pas pu être supprimé (nouvel essai au prochain passage). */
  echecs: number;
}

export interface ResultatPurge extends ResultatEffacement {
  simulation: boolean;
  /** Combien de documents ont dépassé leur durée de conservation. */
  documentsEchus: number;
  /** Plus de documents échus que le plafond d'un passage : le reste attend le suivant. */
  limiteAtteinte: boolean;
}

/**
 * Fin de vie des données : suppression des états des lieux dont la durée de
 * conservation est dépassée (par défaut : sortie du locataire + 3 ans), AVEC leurs
 * fichiers OneDrive (photos et PDF).
 *
 * Point clé : un document n'est supprimé de la base QU'APRÈS la suppression de
 * tous ses fichiers chez Microsoft. Sinon l'identifiant du fichier serait perdu
 * et il resterait à jamais dans le OneDrive : une donnée qu'on croirait effacée.
 */
@Injectable()
export class EdlRetentionService {
  private readonly logger = new Logger('Retention');

  constructor(
    @InjectRepository(EtatDesLieux)
    private readonly repository: Repository<EtatDesLieux>,
    private readonly oneDrive: OneDriveService,
  ) {}

  /**
   * Chaque nuit à 03 h (heure du serveur). Attention : un conteneur « scale-to-zero »
   * dort la nuit et ne l'exécutera pas — d'où `npm run edl:retention`, à lancer par
   * une tâche planifiée de l'hébergeur (voir docs/etat-des-lieux/RGPD.md).
   */
  @Cron('0 3 * * *')
  async purgeQuotidienne(): Promise<void> {
    if (!purgeAutomatiqueActive()) {
      return;
    }

    try {
      const resultat = await this.purger();
      if (resultat.documentsEchus > 0) {
        this.logger.log(
          `Purge : ${resultat.documentsSupprimes} document(s) supprimé(s), ${resultat.fichiersSupprimes} fichier(s) OneDrive, ${resultat.echecs} échec(s)`,
        );
      }
    } catch (erreur) {
      this.logger.error(
        `Purge impossible (${erreur instanceof Error ? erreur.message : 'erreur inconnue'})`,
      );
    }
  }

  /** Jour avant lequel une sortie rend le document échu (« AAAA-MM-JJ »). */
  dateLimite(maintenant: Date = new Date()): string {
    const limite = new Date(maintenant);
    limite.setUTCFullYear(limite.getUTCFullYear() - anneesConservation());
    return limite.toISOString().slice(0, 10);
  }

  /**
   * Documents dont le locataire est SORTI depuis plus que la durée de
   * conservation. Un locataire encore en place (pas de date de sortie) n'est
   * jamais concerné.
   */
  documentsEchus(maintenant: Date = new Date()): Promise<EtatDesLieux[]> {
    return this.repository.find({
      where: { locataire: { sortie: LessThan(this.dateLimite(maintenant)) } },
      relations: { pieces: { elements: { photos: true } } },
      order: { dateCreation: 'ASC' },
    });
  }

  async purger(
    options: { simulation?: boolean; maintenant?: Date } = {},
  ): Promise<ResultatPurge> {
    const echus = await this.documentsEchus(options.maintenant);
    const lot = echus.slice(0, PURGE_LIMITE_PAR_PASSAGE);
    const simulation = options.simulation ?? false;

    const base: ResultatPurge = {
      simulation,
      documentsEchus: echus.length,
      limiteAtteinte: echus.length > lot.length,
      documentsSupprimes: 0,
      fichiersSupprimes: 0,
      echecs: 0,
    };

    if (simulation || lot.length === 0) {
      return base;
    }

    return { ...base, ...(await this.effacer(lot)) };
  }

  /** Supprime des documents ET leurs fichiers OneDrive. Sert à la purge et au droit à l'effacement. */
  async effacer(documents: EtatDesLieux[]): Promise<ResultatEffacement> {
    const resultat: ResultatEffacement = {
      documentsSupprimes: 0,
      fichiersSupprimes: 0,
      echecs: 0,
    };

    for (const document of documents) {
      const fichiers = [
        ...document.pieces
          .flatMap((piece) => piece.elements)
          .flatMap((element) => element.photos)
          .map((photo) => photo.oneDriveItemId),
        document.pdfOneDriveItemId,
      ].filter((id): id is string => Boolean(id));

      try {
        for (const id of fichiers) {
          await this.oneDrive.supprimer(id);
          resultat.fichiersSupprimes++;
        }
      } catch {
        // OneDrive indisponible ou révoqué : on GARDE le document (et donc les
        // identifiants des fichiers restants) pour réessayer.
        resultat.echecs++;
        this.logger.warn(
          `Effacement du document ${document.id} reporté : OneDrive a refusé`,
        );
        continue;
      }

      await this.repository.delete({ id: document.id });
      resultat.documentsSupprimes++;
      this.logger.log(
        `Document ${document.id} supprimé (${fichiers.length} fichier(s) OneDrive)`,
      );
    }

    return resultat;
  }
}
