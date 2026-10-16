import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { construireChemin } from '../onedrive/onedrive-chemin';
import { OneDriveService } from '../onedrive/onedrive.service';
import { PhotoReponse, versPhotoReponse } from './dto/etat-des-lieux-reponse';
import { EdlElement } from './edl-element.entity';
import { EdlPhoto } from './edl-photo.entity';
import { EtatDesLieux } from './etat-des-lieux.entity';
import {
  StatutEtatDesLieux,
  StatutSyncPhoto,
  TypeEtatDesLieux,
} from './etat-des-lieux.enums';
import { CODE_DEJA_SIGNE } from './guards/edl-token.guard';
import { EXTENSIONS, TypeImage, detecterTypeImage } from './image-type';

/** Une photo de plus que ça sur un élément, et on se retrouve avec un album plutôt qu'un constat. */
export const PHOTOS_MAX_PAR_ELEMENT = 5;
/** Plafond d'un fichier reçu. Le client en envoie ~0,5 Mo (1600 px, JPEG). */
export const TAILLE_MAX_PHOTO = 8 * 1024 * 1024;

export const CODE_TROP_DE_PHOTOS = 'TROP_DE_PHOTOS';
export const CODE_FICHIER_INVALIDE = 'FICHIER_INVALIDE';
export const CODE_NON_MODIFIABLE_PHOTO = 'NON_MODIFIABLE';

/** Ce qui est nécessaire pour ranger une photo : document + élément + pièce, vérifiés ensemble. */
interface ContextePhoto {
  edl: EtatDesLieux;
  element: EdlElement;
}

/**
 * Photos des éléments. Le fichier vit sur OneDrive ; la base garde l'identifiant
 * et le lien. Ce service orchestre : contrôle du fichier, de l'élément, envoi
 * OneDrive, puis enregistrement — dans cet ordre, pour ne jamais avoir en base
 * une photo qui n'existe pas chez Microsoft.
 *
 * Si OneDrive est indisponible, rien n'est enregistré : l'erreur remonte, et
 * l'appareil du locataire, qui garde la photo, la renverra.
 */
@Injectable()
export class EdlPhotoService {
  private readonly logger = new Logger('EtatDesLieux');

  constructor(
    @InjectRepository(EdlElement)
    private readonly elements: Repository<EdlElement>,
    @InjectRepository(EdlPhoto)
    private readonly photos: Repository<EdlPhoto>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly oneDrive: OneDriveService,
  ) {}

  async ajouter(
    edlId: string,
    elementId: string,
    photoId: string,
    contenu: Buffer,
  ): Promise<PhotoReponse> {
    const type = detecterTypeImage(contenu);
    if (type === null) {
      throw new UnsupportedMediaTypeException({
        message: 'Le fichier n’est pas une image (JPEG, PNG ou WebP attendu).',
        code: CODE_FICHIER_INVALIDE,
      });
    }

    // Contrôles AVANT l'envoi : pas la peine de téléverser ce qu'on refusera.
    const { edl, element } = await this.contexte(edlId, elementId);
    this.verifierModifiable(edl.statut);

    const existante = await this.photos.findOneBy({ id: photoId });
    if (existante) {
      return this.reponseSiMemeElement(existante, elementId);
    }
    if ((await this.photos.countBy({ elementId })) >= PHOTOS_MAX_PAR_ELEMENT) {
      throw this.tropDePhotos();
    }

    const chemin = construireChemin({
      adresse: edl.adresse,
      locataire: `${edl.locataire.nom} ${edl.locataire.prenom}`,
      type: edl.type === TypeEtatDesLieux.SORTIE ? 'sortie' : 'entree',
      piece: element.piece.nom,
      element: element.nom,
      date: new Date(),
      photoId,
      extension: EXTENSIONS[type],
    });
    const fichier = await this.oneDrive.televerser(chemin, contenu, type);

    try {
      const photo = await this.dataSource.transaction((manager) =>
        this.enregistrer(manager, edlId, elementId, photoId, fichier),
      );
      this.logger.log(
        `Photo ${photoId} ajoutée à l'élément ${elementId} de ${edlId}`,
      );
      return versPhotoReponse(photo);
    } catch (erreur) {
      // L'envoi a réussi mais la photo n'a pas pu être enregistrée (document
      // signé entre-temps, course…) : on retire le fichier pour ne pas laisser
      // d'orphelin chez Microsoft. Au mieux : un échec ici n'écrase pas l'erreur d'origine.
      await this.oneDrive.supprimer(fichier.itemId).catch(() => undefined);

      if (erreur instanceof PhotoDejaEnregistree) {
        return versPhotoReponse(erreur.photo);
      }
      throw erreur;
    }
  }

  /**
   * Supprime une photo (document non signé). Idempotent : une photo déjà absente
   * est un succès. On retire d'abord le fichier chez Microsoft, puis la ligne :
   * si OneDrive est en panne, la ligne reste et la suppression sera rejouée.
   */
  async supprimer(edlId: string, photoId: string): Promise<void> {
    const photo = await this.chargerPhoto(edlId, photoId);
    if (!photo) {
      return;
    }

    const edl = await this.dataSource
      .getRepository(EtatDesLieux)
      .findOneByOrFail({ id: edlId });
    this.verifierModifiable(edl.statut);

    if (photo.oneDriveItemId) {
      await this.oneDrive.supprimer(photo.oneDriveItemId);
    }
    await this.photos.delete({ id: photoId });
    this.logger.log(`Photo ${photoId} supprimée de ${edlId}`);
  }

  /** Octets d'une photo, relus depuis OneDrive : le locataire ne voit jamais Microsoft. */
  async contenu(
    edlId: string,
    photoId: string,
  ): Promise<{ contenu: Buffer; type: TypeImage }> {
    const photo = await this.chargerPhoto(edlId, photoId);
    if (!photo?.oneDriveItemId) {
      throw new NotFoundException('Photo introuvable');
    }

    const contenu = await this.oneDrive.telecharger(photo.oneDriveItemId);
    return { contenu, type: detecterTypeImage(contenu) ?? 'image/jpeg' };
  }

  // ----------------------------------------------------------------- interne

  private async enregistrer(
    manager: EntityManager,
    edlId: string,
    elementId: string,
    photoId: string,
    fichier: { itemId: string; webUrl: string },
  ): Promise<EdlPhoto> {
    // Verrou partagé sur le document : une signature simultanée attend notre fin,
    // et notre insertion tardive voit le document signé.
    const edl = await manager
      .getRepository(EtatDesLieux)
      .createQueryBuilder('edl')
      .select(['edl.id', 'edl.statut'])
      .where('edl.id = :edlId', { edlId })
      .setLock('pessimistic_read')
      .getOne();
    if (!edl) {
      throw new NotFoundException('État des lieux introuvable');
    }
    this.verifierModifiable(edl.statut);

    // Verrou exclusif sur l'élément : deux envois simultanés se comptent à tour de rôle.
    await manager
      .getRepository(EdlElement)
      .createQueryBuilder('element')
      .where('element.id = :elementId', { elementId })
      .setLock('pessimistic_write', undefined, ['element'])
      .getOne();

    const dejaLa = await manager.findOneBy(EdlPhoto, { id: photoId });
    if (dejaLa) {
      throw new PhotoDejaEnregistree(dejaLa);
    }
    if (
      (await manager.countBy(EdlPhoto, { elementId })) >= PHOTOS_MAX_PAR_ELEMENT
    ) {
      throw this.tropDePhotos();
    }

    return manager.save(
      manager.create(EdlPhoto, {
        id: photoId,
        elementId,
        oneDriveItemId: fichier.itemId,
        oneDriveUrl: fichier.webUrl,
        statutSync: StatutSyncPhoto.SYNCED,
      }),
    );
  }

  /** Document + élément + pièce, en vérifiant que l'élément appartient bien à CE document. */
  private async contexte(
    edlId: string,
    elementId: string,
  ): Promise<ContextePhoto> {
    const element = await this.elements
      .createQueryBuilder('element')
      .innerJoinAndSelect('element.piece', 'piece')
      .where('element.id = :elementId', { elementId })
      .andWhere('piece.etatDesLieuxId = :edlId', { edlId })
      .getOne();
    if (!element) {
      throw new NotFoundException('Élément introuvable dans ce document');
    }

    const edl = await this.dataSource
      .getRepository(EtatDesLieux)
      .findOneOrFail({ where: { id: edlId }, relations: { locataire: true } });

    return { edl, element };
  }

  private async chargerPhoto(
    edlId: string,
    photoId: string,
  ): Promise<EdlPhoto | null> {
    return this.photos
      .createQueryBuilder('photo')
      .innerJoin('photo.element', 'element')
      .innerJoin('element.piece', 'piece')
      .where('photo.id = :photoId', { photoId })
      .andWhere('piece.etatDesLieuxId = :edlId', { edlId })
      .getOne();
  }

  private reponseSiMemeElement(
    photo: EdlPhoto,
    elementId: string,
  ): PhotoReponse {
    // Même identifiant sur un AUTRE élément : ce n'est pas un rejeu, c'est un conflit.
    if (photo.elementId !== elementId) {
      throw new ConflictException({
        message: 'Cet identifiant de photo est déjà utilisé.',
        code: 'PHOTO_EXISTANTE',
      });
    }
    return versPhotoReponse(photo);
  }

  private verifierModifiable(statut: StatutEtatDesLieux): void {
    if (statut === StatutEtatDesLieux.SIGNED) {
      throw new ConflictException({
        message: 'Ce document est déjà signé : il ne peut plus être modifié.',
        code: CODE_DEJA_SIGNE,
      });
    }
    if (statut !== StatutEtatDesLieux.DRAFT) {
      throw new ConflictException({
        message:
          'Ce document est validé : les photos ne sont plus modifiables.',
        code: CODE_NON_MODIFIABLE_PHOTO,
      });
    }
  }

  private tropDePhotos(): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: `${PHOTOS_MAX_PAR_ELEMENT} photos au maximum par élément.`,
      code: CODE_TROP_DE_PHOTOS,
    });
  }
}

/** Interne : la photo a été enregistrée par une requête concurrente (rejeu simultané). */
class PhotoDejaEnregistree extends Error {
  constructor(readonly photo: EdlPhoto) {
    super('photo déjà enregistrée');
  }
}
