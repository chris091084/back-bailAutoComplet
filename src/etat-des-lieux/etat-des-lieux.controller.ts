import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { OneDriveService } from '../onedrive/onedrive.service';
import { EdlPdfService } from './edl-pdf.service';
import { EdlSignatureService, SuitesSignature } from './edl-signature.service';
import { EtatDesLieux } from './etat-des-lieux.entity';
import { StatutEtatDesLieux } from './etat-des-lieux.enums';
import { CreateEtatDesLieuxDto } from './dto/create-etat-des-lieux.dto';
import {
  EtatDesLieuxReponse,
  EtatDesLieuxResume,
} from './dto/etat-des-lieux-reponse';
import {
  EtatDesLieuxService,
  LienEtatDesLieux,
} from './etat-des-lieux.service';

/**
 * Routes du BAILLEUR. Aucun `@Public()` : le guard global les ferme derrière la
 * session, comme tout le reste de l'API.
 *
 * Elles partagent le préfixe des routes locataire (`:token`), sans collision :
 * ici le segment suivant est fixe (`detail`, `lien`, `pdf`…) ou absent.
 */
@Controller('etats-des-lieux')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class EtatDesLieuxController {
  constructor(
    private readonly service: EtatDesLieuxService,
    private readonly signature: EdlSignatureService,
    private readonly pdf: EdlPdfService,
    private readonly oneDrive: OneDriveService,
    @InjectRepository(EtatDesLieux)
    private readonly repository: Repository<EtatDesLieux>,
  ) {}

  /** Crée le document et renvoie le lien à transmettre au locataire. */
  @Post()
  creer(@Body() body: CreateEtatDesLieuxDto): Promise<LienEtatDesLieux> {
    return this.service.creer(body);
  }

  @Get()
  lister(
    @Query('locataireId', new ParseIntPipe({ optional: true }))
    locataireId?: number,
  ): Promise<EtatDesLieuxResume[]> {
    return this.service.lister(locataireId);
  }

  @Get(':id/detail')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<EtatDesLieuxReponse> {
    return this.service.detail(id);
  }

  /** Remplace le lien (perdu, mal adressé, expiré) : l'ancien cesse de marcher. */
  @Post(':id/lien')
  regenererLien(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LienEtatDesLieux> {
    return this.service.regenererLien(id);
  }

  /** PDF du document : l'archive OneDrive s'il est signé, sinon fabriqué à la demande (brouillon). */
  @Get(':id/pdf')
  async pdfDuDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) reponse: Response,
  ): Promise<StreamableFile> {
    const edl = await this.repository.findOneByOrFail({ id });

    let contenu: Buffer | null = null;
    if (edl.statut === StatutEtatDesLieux.SIGNED && edl.pdfOneDriveItemId) {
      contenu = await this.oneDrive
        .telecharger(edl.pdfOneDriveItemId)
        .catch(() => null);
    }
    contenu ??= await this.pdf.generer(id);

    reponse.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.pdf.nomFichier(edl)}"`,
    );
    return new StreamableFile(contenu, { type: 'application/pdf' });
  }

  /** Rejoue PDF + e-mails + archive d'un document signé (échec d'envoi, adresse corrigée…). */
  @Post(':id/renvoyer')
  @HttpCode(200)
  renvoyer(@Param('id', ParseUUIDPipe) id: string): Promise<SuitesSignature> {
    return this.signature.renvoyer(id);
  }

  /** Lève la validation (jamais la signature) : le locataire peut de nouveau modifier. */
  @Post(':id/reouvrir')
  @HttpCode(200)
  reouvrir(@Param('id', ParseUUIDPipe) id: string) {
    return this.signature.rouvrir(id);
  }

  /** Envoie le lien au locataire par e-mail. */
  @Post(':id/envoyer-lien')
  @HttpCode(200)
  envoyerLien(@Param('id', ParseUUIDPipe) id: string) {
    return this.signature.envoyerLien(id);
  }
}
