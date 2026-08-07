import {
  BadRequestException,
  Controller,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';

/** Un `.docx` de quittance pèse une quinzaine de kilo-octets. */
const TAILLE_MAX = 5 * 1024 * 1024;

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
  constructor(private readonly documentsService: DocumentsService) {}

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

    if (document.mimetype !== DOCX_MIME) {
      throw new BadRequestException(
        'Seuls les documents Word (.docx) sont convertis.',
      );
    }

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

  /** Le front nomme déjà ses fichiers en `.pdf` ; ceci couvre les autres cas. */
  private nomPdf(nomFichier: string): string {
    return nomFichier.replace(/\.docx$/i, '.pdf');
  }
}
