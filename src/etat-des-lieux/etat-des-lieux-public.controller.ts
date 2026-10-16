import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  ServiceUnavailableException,
  StreamableFile,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { Public } from '../auth/guards/public.decorator';
import { OneDriveIndisponibleError } from '../onedrive/onedrive.errors';
import { AjouterPhotoDto } from './dto/ajouter-photo.dto';
import { SignerDto } from './dto/signer.dto';
import {
  EdlSignatureService,
  ResultatSignature,
} from './edl-signature.service';
import {
  CODE_FICHIER_INVALIDE,
  EdlPhotoService,
  TAILLE_MAX_PHOTO,
} from './edl-photo.service';
import { PhotoReponse } from './dto/etat-des-lieux-reponse';
import {
  ElementReponse,
  EtatDesLieuxReponse,
} from './dto/etat-des-lieux-reponse';
import { ModifierElementDto } from './dto/modifier-element.dto';
import { EtatDesLieuxService } from './etat-des-lieux.service';
import { EdlActuel, EdlCourant, EdlTokenGuard } from './guards/edl-token.guard';

/**
 * Routes du LOCATAIRE, ouvertes à qui détient le lien : `@Public()` écarte la
 * session du bailleur, et `EdlTokenGuard` la remplace par la vérification du
 * jeton. Le document visé vient du jeton (`@EdlActuel()`), jamais d'un
 * identifiant fourni dans l'URL ou le corps.
 */
@Public()
@Controller('etats-des-lieux')
@UseGuards(EdlTokenGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class EtatDesLieuxPublicController {
  constructor(
    private readonly service: EtatDesLieuxService,
    private readonly photos: EdlPhotoService,
    private readonly signature: EdlSignatureService,
  ) {}

  @Get(':token')
  lire(@EdlActuel() edl: EdlCourant): Promise<EtatDesLieuxReponse> {
    return this.service.lirePourLocataire(edl.id);
  }

  // Le plafond global (120/min/IP) couvre une saisie normale ; celui-ci borne
  // un client qui rejouerait en boucle.
  @Throttle({ default: { ttl: 60_000, limit: 90 } })
  @Patch(':token/elements/:elementId')
  modifierElement(
    @EdlActuel() edl: EdlCourant,
    @Param('elementId', ParseUUIDPipe) elementId: string,
    @Body() body: ModifierElementDto,
  ): Promise<ElementReponse> {
    return this.service.modifierElement(edl.id, elementId, body);
  }

  /** Validation globale : tous les éléments traités, sinon 422 + liste de ce qui manque. */
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post(':token/validate')
  @HttpCode(200)
  valider(@EdlActuel() edl: EdlCourant) {
    return this.signature.valider(edl.id);
  }

  /**
   * Signature : verrouille tout, puis fabrique le PDF, l'envoie aux deux parties
   * et l'archive. La signature est acquise même si un de ces envois échoue ; la
   * réponse dit ce qui a marché.
   */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post(':token/sign')
  @HttpCode(200)
  signer(
    @EdlActuel() edl: EdlCourant,
    @Body() body: SignerDto,
  ): Promise<ResultatSignature> {
    return this.signature.signer(edl.id, body);
  }

  /**
   * Envoi d'une photo (multipart : champ texte `id` + fichier `photo`). Le
   * fichier reste en mémoire le temps de le passer à OneDrive : le serveur n'a
   * pas de disque durable, et la photo ne doit exister nulle part ailleurs.
   * Plafond de taille posé par multer, avant même d'entrer dans le service.
   */
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post(':token/elements/:elementId/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: TAILLE_MAX_PHOTO, files: 1 },
    }),
  )
  async ajouterPhoto(
    @EdlActuel() edl: EdlCourant,
    @Param('elementId', ParseUUIDPipe) elementId: string,
    @Body() body: AjouterPhotoDto,
    @UploadedFile() fichier: Express.Multer.File | undefined,
    @Res({ passthrough: true }) reponse: Response,
  ): Promise<PhotoReponse> {
    if (!fichier) {
      throw new UnprocessableEntityException({
        message: 'Aucun fichier reçu (champ « photo »).',
        code: CODE_FICHIER_INVALIDE,
      });
    }

    return this.avecOneDrive(reponse, () =>
      this.photos.ajouter(edl.id, elementId, body.id, fichier.buffer),
    );
  }

  @Delete(':token/photos/:photoId')
  @HttpCode(204)
  async supprimerPhoto(
    @EdlActuel() edl: EdlCourant,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Res({ passthrough: true }) reponse: Response,
  ): Promise<void> {
    await this.avecOneDrive(reponse, () =>
      this.photos.supprimer(edl.id, photoId),
    );
  }

  /** Image d'une photo, servie par l'API : le locataire ne voit jamais Microsoft. */
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Get(':token/photos/:photoId')
  async lirePhoto(
    @EdlActuel() edl: EdlCourant,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Res({ passthrough: true }) reponse: Response,
  ): Promise<StreamableFile> {
    const { contenu, type } = await this.avecOneDrive(reponse, () =>
      this.photos.contenu(edl.id, photoId),
    );
    // `private` : le lien est un secret, aucun cache partagé (proxy) ne doit garder l'image.
    reponse.setHeader('Cache-Control', 'private, max-age=3600');
    reponse.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(contenu, { type });
  }

  /**
   * OneDrive indisponible (non connecté, révoqué, quota, 429, panne) → 503 avec
   * `Retry-After` quand Microsoft en donne un. Le client traite 503 comme
   * « à réessayer » : la photo reste chez lui, rien n'est perdu.
   */
  private async avecOneDrive<T>(
    reponse: Response,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (erreur) {
      if (erreur instanceof OneDriveIndisponibleError) {
        if (erreur.retryAfterSecondes) {
          reponse.setHeader('Retry-After', String(erreur.retryAfterSecondes));
        }
        throw new ServiceUnavailableException({
          message: 'Le stockage des photos est momentanément indisponible.',
          code: `ONEDRIVE_${erreur.cause_}`,
        });
      }
      throw erreur;
    }
  }
}
