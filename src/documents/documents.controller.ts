import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MailService, PieceJointe } from '../mail/mail.service';
import { DocumentsService } from './documents.service';
import { EnvoyerDocumentsDto } from './dto/envoyer-documents.dto';

/** Un `.docx` de quittance pèse une quinzaine de kilo-octets. */
const TAILLE_MAX = 5 * 1024 * 1024;

/** Douze : une année de quittances mensuelles, comme `POST /mail/send`. */
const MAX_DOCUMENTS = 12;

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Protégé comme l'envoi de mail : laissée publique, la route offrirait à
 * n'importe qui un LibreOffice gratuit, et de quoi épuiser la mémoire du
 * conteneur en quelques requêtes.
 */
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Le document arrive en `multipart/form-data` et repart en PDF binaire : pas
   * de base64 dans un sens ni dans l'autre, qui gonflerait les échanges d'un
   * tiers pour rien.
   */
  @Post('pdf')
  @UseInterceptors(
    FileInterceptor('document', { limits: { fileSize: TAILLE_MAX } }),
  )
  async convertirEnPdf(
    @UploadedFile() document: Express.Multer.File,
    @Res() reponse: Response,
  ): Promise<void> {
    if (!document) {
      throw new BadRequestException(
        'Aucun document reçu (champ « document » attendu).',
      );
    }

    this.verifierFormat([document]);

    const pdf = await this.documentsService.convertirEnPdf(
      document.buffer,
      document.originalname,
    );

    reponse
      .type('application/pdf')
      .set(
        'Content-Disposition',
        `attachment; filename="${this.nomPdf(document.originalname)}"`,
      )
      .send(pdf);
  }

  /**
   * Convertit les documents en PDF et les envoie dans un seul mail, le tout en
   * une requête.
   *
   * Avec une requête par conversion, le navigateur pilotait la file : à 13 s
   * la conversion sur Scaleway, douze quittances demandaient près de trois
   * minutes d'onglet ouvert, et un onglet rechargé entre-temps (téléphone
   * verrouillé, retour à l'accueil) abandonnait tout sans que le mail parte.
   * Ici, une fois la requête reçue, le serveur va au bout : Express ne
   * s'interrompt pas quand le client se déconnecte.
   */
  @Post('envoyer')
  @HttpCode(204)
  @UseInterceptors(
    FilesInterceptor('documents', MAX_DOCUMENTS, {
      limits: { fileSize: TAILLE_MAX },
    }),
  )
  async convertirEtEnvoyer(
    @UploadedFiles() documents: Express.Multer.File[] | undefined,
    // Posé sur le seul corps : les fichiers ne passent pas par la validation.
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    mail: EnvoyerDocumentsDto,
  ): Promise<void> {
    if (!documents?.length) {
      throw new BadRequestException(
        'Aucun document reçu (champ « documents » attendu).',
      );
    }

    // Tout est vérifié avant la première conversion : mieux vaut refuser tout
    // de suite qu'après une minute de LibreOffice.
    this.verifierFormat(documents);

    // Une à une : `DocumentsService` sérialise de toute façon les conversions.
    const piecesJointes: PieceJointe[] = [];
    for (const document of documents) {
      piecesJointes.push({
        filename: this.nomPdf(document.originalname),
        content: await this.documentsService.convertirEnPdf(
          document.buffer,
          document.originalname,
        ),
      });
    }

    await this.mailService.envoyer({ ...mail, attachments: piecesJointes });
  }

  private verifierFormat(documents: Express.Multer.File[]): void {
    if (documents.some((document) => document.mimetype !== DOCX_MIME)) {
      throw new BadRequestException(
        'Seuls les documents Word (.docx) sont convertis.',
      );
    }
  }

  /** Le front nomme déjà ses fichiers en `.pdf` ; ceci couvre les autres cas. */
  private nomPdf(nomFichier: string): string {
    return nomFichier.replace(/\.docx$/i, '.pdf');
  }
}
