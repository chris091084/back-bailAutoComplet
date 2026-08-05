import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { convertWithOptions } from 'libreoffice-convert';
import { promisify } from 'util';

const convertir = promisify(convertWithOptions);

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  /**
   * Une conversion à la fois. LibreOffice démarre un processus par appel et en
   * consomme l'essentiel de la mémoire du conteneur ; deux conversions
   * simultanées le feraient tomber pour dépassement (OOM). Les demandes
   * s'enchaînent donc sur cette promesse plutôt que de se marcher dessus.
   *
   * Le front espace déjà ses quittances, mais rien ne garantit qu'un second
   * onglet ne demandera pas une conversion au même instant.
   */
  private file: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: ConfigService) {}

  /**
   * Convertit un document bureautique (`.docx`) en PDF.
   *
   * La conversion est déléguée à LibreOffice, installé dans l'image de l'API :
   * c'est le seul moyen d'obtenir un PDF fidèle à un modèle Word que le
   * bailleur retouche lui-même.
   */
  async convertirEnPdf(document: Buffer, nomFichier: string): Promise<Buffer> {
    const debut = Date.now();
    const conversion = this.file.then(() => this.lancerConversion(document));
    // La file continue même si cette conversion échoue : sans ce rattrapage,
    // un échec bloquerait toutes les demandes suivantes.
    this.file = conversion.catch(() => undefined);

    try {
      const pdf = await conversion;
      this.logger.log(
        `Converti ${nomFichier} en PDF en ${Date.now() - debut} ms`,
      );
      return pdf;
    } catch (error) {
      // Le détail (chemins, sortie de soffice) ne doit pas remonter au
      // navigateur.
      this.logger.error(
        `Échec de la conversion de ${nomFichier} en PDF`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'La conversion du document en PDF a échoué.',
      );
    }
  }

  private lancerConversion(document: Buffer): Promise<Buffer> {
    // Renseigné uniquement si LibreOffice n'est pas là où la bibliothèque le
    // cherche ; inutile avec l'image Docker du projet.
    const cheminSoffice = this.config.get<string>('SOFFICE_PATH');

    return convertir(document, '.pdf', undefined, {
      ...(cheminSoffice ? { sofficeBinaryPaths: [cheminSoffice] } : {}),
      // LibreOffice écrit un profil utilisateur au premier lancement : sans
      // répertoire inscriptible, il refuse de démarrer. `/tmp` l'est sur
      // Scaleway Serverless Containers, contrairement au reste du système de
      // fichiers.
      tmpOptions: { dir: '/tmp' },
    });
  }
}
