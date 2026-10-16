import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync } from 'node:fs';
import { launch } from 'puppeteer-core';
import { Repository } from 'typeorm';
import { OneDriveService } from '../onedrive/onedrive.service';
import {
  DonneesPdf,
  ElementPdf,
  PhotoPdf,
  genererHtml,
} from './edl-pdf.template';
import { EtatDesLieux } from './etat-des-lieux.entity';
import {
  StatutEtatDesLieux,
  StatutValidation,
  TypeEtatDesLieux,
} from './etat-des-lieux.enums';
import { libelleEtat } from './etat-libelles';
import { detecterTypeImage } from './image-type';

/**
 * Où chercher un Chromium quand `PUPPETEER_EXECUTABLE_PATH` n'est pas posé.
 * `chromium-browser` passe en DERNIER : sur Ubuntu, ce chemin n'est souvent qu'une
 * cale vers un paquet snap non installé (il existe, mais ne démarre pas).
 */
const CHEMINS_NAVIGATEUR = [
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
];

/** Photos téléchargées depuis OneDrive en parallèle (au-delà : on s'expose à un 429). */
const PARALLELISME_PHOTOS = 4;
const DELAI_PDF_MS = 60_000;

/** Largeur des miniatures dans le PDF : lisible à l'impression, sans gonfler le fichier. */
const LARGEUR_MINIATURE = 480;

export const cheminNavigateur = (): string | null =>
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  CHEMINS_NAVIGATEUR.find((chemin) => existsSync(chemin)) ??
  null;

const formaterDate = (
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string =>
  date.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', ...options });

export const dateLongue = (date: Date): string =>
  formaterDate(date, { day: 'numeric', month: 'long', year: 'numeric' });

const dateCourte = (date: Date): string =>
  formaterDate(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Fabrique le PDF d'un état des lieux : gabarit HTML (`edl-pdf.template.ts`)
 * rendu par Chromium sans interface (Puppeteer).
 *
 * Chromium est LOURD (plusieurs centaines de Mo de mémoire) : un PDF à la fois, et
 * le navigateur est lancé puis fermé à chaque document pour rendre la mémoire.
 * `puppeteer-core` ne télécharge aucun navigateur : on utilise celui du système
 * (installé dans l'image Docker).
 */
@Injectable()
export class EdlPdfService {
  private readonly logger = new Logger('EdlPdf');
  private file: Promise<unknown> = Promise.resolve();

  constructor(
    @InjectRepository(EtatDesLieux)
    private readonly repository: Repository<EtatDesLieux>,
    private readonly oneDrive: OneDriveService,
  ) {}

  async generer(edlId: string): Promise<Buffer> {
    const donnees = await this.rassembler(edlId);
    return this.enFile(() => this.imprimer(genererHtml(donnees)));
  }

  /** Nom de fichier proposé : `etat-des-lieux-entree-2026-10-15.pdf`. */
  nomFichier(
    edl: Pick<EtatDesLieux, 'type' | 'dateSignature' | 'dateCreation'>,
  ): string {
    const date = (edl.dateSignature ?? edl.dateCreation)
      .toISOString()
      .slice(0, 10);
    return `etat-des-lieux-${edl.type}-${date}.pdf`;
  }

  /** Les données du document, photos incluses (en URL de données), prêtes pour le gabarit. */
  async rassembler(edlId: string): Promise<DonneesPdf> {
    const edl = await this.repository.findOne({
      where: { id: edlId },
      relations: {
        appartement: { bailleur: true },
        locataire: true,
        pieces: { elements: { photos: true } },
      },
    });
    if (!edl) {
      throw new NotFoundException('État des lieux introuvable');
    }

    const photos = await this.chargerPhotos(
      edl.pieces.flatMap((p) => p.elements).flatMap((e) => e.photos),
    );
    const bailleur = edl.appartement.bailleur;

    return {
      titre:
        edl.type === TypeEtatDesLieux.SORTIE
          ? 'État des lieux de sortie'
          : 'État des lieux d’entrée',
      brouillon: edl.statut !== StatutEtatDesLieux.SIGNED,
      dateSignature: edl.dateSignature ? dateLongue(edl.dateSignature) : null,
      bailleur: bailleur
        ? {
            nom: bailleur.name,
            adresse: bailleur.adress,
            email: bailleur.email,
            telephone: bailleur.telephone,
          }
        : null,
      locataire: {
        nomComplet: `${edl.locataire.prenom} ${edl.locataire.nom}`,
        email: edl.locataire.email,
        telephone: edl.locataire.telephone,
      },
      logement: {
        adresse: edl.adresse,
        chauffage: edl.chauffage,
        clesRemises: edl.clesRemises,
      },
      pieces: [...edl.pieces]
        .sort((a, b) => a.ordre - b.ordre)
        .map((piece) => ({
          nom: piece.nom,
          elements: [...piece.elements]
            .sort((a, b) => a.ordre - b.ordre)
            .map((element): ElementPdf => ({
              nom: element.nom,
              etatBailleur: libelleEtat(element.etatBailleur),
              commentaireBailleur: element.commentaireBailleur,
              etatLocataire: libelleEtat(element.etatLocataire),
              commentaireLocataire: element.commentaireLocataire,
              dateSaisie:
                element.dateModifLocataire &&
                (element.etatLocataire || element.commentaireLocataire)
                  ? dateCourte(element.dateModifLocataire)
                  : null,
              valideTelQuel:
                element.statutValidation === StatutValidation.VALIDE &&
                !element.etatLocataire &&
                !element.commentaireLocataire,
              photos: [...element.photos]
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                .map((photo): PhotoPdf => ({
                  src: photos.get(photo.id) ?? null,
                })),
            })),
        })),
      signatureBailleur: edl.signatureBailleur
        ? `data:image/png;base64,${edl.signatureBailleur}`
        : null,
      signatureLocataire: edl.signatureLocataire
        ? `data:image/png;base64,${edl.signatureLocataire}`
        : null,
      empreinte: edl.empreinte,
    };
  }

  // ----------------------------------------------------------------- interne

  /**
   * Télécharge les photos (4 à la fois). Une photo introuvable ne fait pas
   * échouer le PDF : elle est signalée dans le document (« Photo non
   * récupérable ») et journalisée, car un état des lieux ne doit pas rester
   * bloqué parce qu'un fichier a été supprimé à la main dans OneDrive.
   */
  private async chargerPhotos(
    photos: { id: string; oneDriveItemId: string | null }[],
  ): Promise<Map<string, string>> {
    const resultat = new Map<string, string>();
    const aTraiter = [...photos];

    const travailleur = async (): Promise<void> => {
      for (let photo = aTraiter.shift(); photo; photo = aTraiter.shift()) {
        if (!photo.oneDriveItemId) {
          continue;
        }
        try {
          const contenu = await this.oneDrive.telecharger(photo.oneDriveItemId);
          const type = detecterTypeImage(contenu);
          if (type) {
            resultat.set(
              photo.id,
              `data:${type};base64,${contenu.toString('base64')}`,
            );
          }
        } catch {
          this.logger.warn(`Photo ${photo.id} non récupérable pour le PDF`);
        }
      }
    };

    await Promise.all(Array.from({ length: PARALLELISME_PHOTOS }, travailleur));
    return resultat;
  }

  /** Un PDF à la fois : deux Chromium simultanés feraient tomber le conteneur (mémoire). */
  private enFile<T>(travail: () => Promise<T>): Promise<T> {
    const execution = this.file.then(travail);
    this.file = execution.catch(() => undefined);
    return execution;
  }

  private async imprimer(html: string): Promise<Buffer> {
    const executablePath = cheminNavigateur();
    if (!executablePath) {
      throw new InternalServerErrorException(
        'Aucun navigateur pour fabriquer le PDF : installez Chromium ou renseignez PUPPETEER_EXECUTABLE_PATH.',
      );
    }

    const debut = Date.now();
    const navigateur = await launch({
      executablePath,
      headless: true,
      timeout: DELAI_PDF_MS,
      args: [
        // Dans un conteneur on tourne en root, ce qui interdit le bac à sable de Chromium ;
        // le seul contenu rendu est le nôtre (échappé, sans réseau, voir plus bas).
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // /dev/shm est minuscule dans un conteneur : Chromium s'y écroulerait.
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const page = await navigateur.newPage();
      page.setDefaultTimeout(DELAI_PDF_MS);

      // Le document n'a besoin d'aucune ressource externe : tout est en URL de
      // données. On coupe le reste, par principe (un contenu injecté ne doit pas
      // pouvoir appeler l'extérieur depuis le conteneur).
      await page.setRequestInterception(true);
      page.on('request', (requete) => {
        const url = requete.url();
        if (url.startsWith('data:') || url.startsWith('about:')) {
          void requete.continue();
        } else {
          void requete.abort('blockedbyclient');
        }
      });

      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(reduireMiniatures, LARGEUR_MINIATURE);

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate:
          '<div style="font-size:8px;width:100%;text-align:center;color:#666"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
        margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
      });

      this.logger.log(
        `PDF généré en ${Date.now() - debut} ms (${pdf.length} octets)`,
      );
      return Buffer.from(pdf);
    } catch (erreur) {
      this.logger.error(
        'Échec de la génération du PDF',
        erreur instanceof Error ? erreur.stack : String(erreur),
      );
      throw new InternalServerErrorException('La génération du PDF a échoué.');
    } finally {
      await navigateur.close().catch(() => undefined);
    }
  }
}

/**
 * Exécutée DANS la page : redessine chaque photo en miniature. Chromium écrit
 * sinon l'image d'origine (1600 px) telle quelle dans le PDF, qui pèserait
 * plusieurs dizaines de Mo.
 */
async function reduireMiniatures(largeurMax: number): Promise<void> {
  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>('img.miniature'),
  );

  await Promise.all(
    images.map(async (image) => {
      await image.decode().catch(() => undefined);
      if (!image.naturalWidth || image.naturalWidth <= largeurMax) {
        return;
      }

      const echelle = largeurMax / image.naturalWidth;
      const canvas = document.createElement('canvas');
      canvas.width = largeurMax;
      canvas.height = Math.round(image.naturalHeight * echelle);
      canvas
        .getContext('2d')
        ?.drawImage(image, 0, 0, canvas.width, canvas.height);

      image.src = canvas.toDataURL('image/jpeg', 0.75);
      await image.decode().catch(() => undefined);
    }),
  );
}
