import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { Locataire } from '../locataire/locataire.entity';
import {
  CreateEtatDesLieuxDto,
  PieceModeleDto,
} from './dto/create-etat-des-lieux.dto';
import {
  ElementReponse,
  EtatDesLieuxReponse,
  EtatDesLieuxResume,
  versElementReponse,
  versEtatDesLieuxReponse,
  versResume,
} from './dto/etat-des-lieux-reponse';
import { ModifierElementDto } from './dto/modifier-element.dto';
import {
  EdlElementHistorique,
  InstantaneElement,
} from './edl-element-historique.entity';
import { EdlElement } from './edl-element.entity';
import { EdlPhoto } from './edl-photo.entity';
import { edlTokenTtlJours } from './edl-token.config';
import { EdlTokenService } from './edl-token.service';
import {
  CODE_VERSION_PLUS_RECENTE,
  appliquerModification,
} from './element-regles';
import { EtatDesLieux } from './etat-des-lieux.entity';
import {
  AuteurModification,
  StatutEtatDesLieux,
  TypeEtatDesLieux,
} from './etat-des-lieux.enums';
import { EtatElement } from './etat-element.enum';
import { CODE_DEJA_SIGNE } from './guards/edl-token.guard';
import { PIECES_PAR_DEFAUT } from './modele-par-defaut';

/** Code renvoyé quand on écrit dans un document déjà validé (verrouillé avant signature). */
export const CODE_NON_MODIFIABLE = 'NON_MODIFIABLE';

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Clé de rapprochement d'un élément de sortie avec celui de l'entrée : sans casse ni accents. */
const cle = (piece: string, element: string): string =>
  `${piece}|${element}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Ce qu'un état d'entrée a « retenu » pour un élément : la saisie du locataire prime sur celle du bailleur. */
const valeurRetenue = (
  element: EdlElement,
): { etat: EtatElement | null; commentaire: string | null } => ({
  etat: element.etatLocataire ?? element.etatBailleur,
  commentaire: element.commentaireLocataire ?? element.commentaireBailleur,
});

export interface LienEtatDesLieux {
  id: string;
  lien: string;
  expireLe: string;
}

@Injectable()
export class EtatDesLieuxService {
  private readonly logger = new Logger('EtatDesLieux');

  constructor(
    @InjectRepository(EtatDesLieux)
    private readonly repository: Repository<EtatDesLieux>,
    @InjectRepository(Locataire)
    private readonly locataireRepository: Repository<Locataire>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tokens: EdlTokenService,
  ) {}

  // ---------------------------------------------------------------- bailleur

  async creer(dto: CreateEtatDesLieuxDto): Promise<LienEtatDesLieux> {
    if (dto.type === TypeEtatDesLieux.ENTREE && dto.etatEntreeRefId) {
      throw new BadRequestException(
        "etatEntreeRefId n'a de sens que pour un état des lieux de sortie.",
      );
    }

    const locataire = await this.locataireRepository.findOne({
      where: { id: dto.locataireId },
      relations: { appartement: true },
    });
    if (!locataire) {
      throw new NotFoundException(`Locataire ${dto.locataireId} introuvable`);
    }

    const reference =
      dto.type === TypeEtatDesLieux.SORTIE
        ? await this.resoudreReference(locataire.id, dto.etatEntreeRefId)
        : null;

    const appartement = locataire.appartement;
    const maintenant = new Date();

    const edl = this.repository.create({
      type: dto.type,
      statut: StatutEtatDesLieux.DRAFT,
      appartementId: appartement.id,
      locataireId: locataire.id,
      etatEntreeRefId: reference?.id ?? null,
      adresse: appartement.adress,
      chauffage:
        dto.chauffage ??
        `${appartement.energieHeating} (${appartement.chauffageCollectif ? 'collectif' : 'individuel'})`,
      clesRemises: dto.clesRemises ?? null,
      lienJti: randomUUID(),
      lienExpireLe: new Date(
        maintenant.getTime() + edlTokenTtlJours() * JOUR_MS,
      ),
      pieces: this.construirePieces(dto.pieces, reference),
    });

    const enregistre = await this.repository.save(edl);
    this.logger.log(
      `Création ${enregistre.type} ${enregistre.id} (locataire ${locataire.id}, ${enregistre.pieces.length} pièce(s))`,
    );

    return this.versLien(enregistre);
  }

  async lister(locataireId?: number): Promise<EtatDesLieuxResume[]> {
    const where: FindOptionsWhere<EtatDesLieux> =
      locataireId === undefined ? {} : { locataireId };

    const documents = await this.repository.find({
      where,
      relations: { pieces: { elements: true } },
      order: { dateCreation: 'DESC' },
    });

    return documents.map(versResume);
  }

  async detail(id: string): Promise<EtatDesLieuxReponse> {
    return versEtatDesLieuxReponse(await this.charger(id));
  }

  /**
   * Nouveau lien pour un document non signé. L'ancien cesse de fonctionner
   * aussitôt (le `jti` change), même s'il n'avait pas expiré : c'est la parade
   * à un lien envoyé à la mauvaise personne.
   */
  async regenererLien(id: string): Promise<LienEtatDesLieux> {
    const edl = await this.repository.findOneBy({ id });
    if (!edl) {
      throw new NotFoundException('État des lieux introuvable');
    }
    if (edl.statut === StatutEtatDesLieux.SIGNED) {
      throw new ConflictException({
        message:
          'Ce document est signé : son lien ne peut plus être renouvelé.',
        code: CODE_DEJA_SIGNE,
      });
    }

    edl.lienJti = randomUUID();
    edl.lienExpireLe = new Date(Date.now() + edlTokenTtlJours() * JOUR_MS);
    await this.repository.save(edl);
    this.logger.log(`Lien renouvelé pour ${id}`);

    return this.versLien(edl);
  }

  // --------------------------------------------------------------- locataire

  async lirePourLocataire(id: string): Promise<EtatDesLieuxReponse> {
    this.logger.log(`Consultation locataire de ${id}`);
    return this.detail(id);
  }

  /**
   * Écrit la saisie du locataire sur un élément, de façon IDEMPOTENTE : rejouer
   * la même requête (coupure réseau, file de synchro) donne le même résultat et
   * n'ajoute pas de ligne d'historique.
   *
   * Tout se passe dans une transaction qui verrouille la ligne :
   *   - le document (verrou partagé) : une signature simultanée attend la fin
   *     de nos écritures, et nos écritures tardives voient le document signé ;
   *   - l'élément (verrou exclusif) : deux rejeux concurrents s'enchaînent.
   * L'élément est cherché AVEC l'id du document : un jeton ne doit jamais
   * permettre de toucher l'élément d'un autre état des lieux.
   */
  async modifierElement(
    edlId: string,
    elementId: string,
    dto: ModifierElementDto,
  ): Promise<ElementReponse> {
    return this.dataSource.transaction(async (manager) => {
      await this.verifierModifiable(manager, edlId);

      const element = await manager
        .getRepository(EdlElement)
        .createQueryBuilder('element')
        .innerJoin('element.piece', 'piece')
        .where('element.id = :elementId', { elementId })
        .andWhere('piece.etatDesLieuxId = :edlId', { edlId })
        .setLock('pessimistic_write', undefined, ['element'])
        .getOne();

      if (!element) {
        throw new NotFoundException('Élément introuvable dans ce document');
      }

      const maintenant = new Date();
      let resultat;
      try {
        resultat = appliquerModification(element, dto, maintenant);
      } catch (error) {
        if (
          error instanceof ConflictException &&
          (error.getResponse() as { code?: string }).code ===
            CODE_VERSION_PLUS_RECENTE
        ) {
          // Le client reçoit la version du serveur pour s'y aligner sans
          // deuxième appel.
          element.photos = await this.photosDe(manager, element.id);
          throw new ConflictException({
            ...(error.getResponse() as object),
            element: versElementReponse(element),
          });
        }
        throw error;
      }

      if (resultat.modifie) {
        await manager.save(element);
        await manager.insert(EdlElementHistorique, {
          elementId: element.id,
          auteur: AuteurModification.LOCATAIRE,
          ancienneValeur: resultat.avant,
          nouvelleValeur: resultat.apres,
          modifieLeClient: resultat.horodatage,
        });
        // Ni commentaire ni signature dans les logs : seulement QUOI a changé.
        this.logger.log(
          `Élément ${element.id} de ${edlId} modifié par le locataire (${this.champsModifies(resultat.avant, resultat.apres)})`,
        );
      }

      element.photos = await this.photosDe(manager, element.id);
      return versElementReponse(element);
    });
  }

  // ----------------------------------------------------------------- interne

  private async charger(id: string): Promise<EtatDesLieux> {
    const edl = await this.repository.findOne({
      where: { id },
      relations: {
        appartement: { bailleur: true },
        locataire: true,
        pieces: { elements: { photos: true } },
      },
    });

    if (!edl) {
      throw new NotFoundException('État des lieux introuvable');
    }

    return edl;
  }

  /** Verrou partagé sur le document puis contrôle du statut : seul `draft` accepte des saisies. */
  private async verifierModifiable(
    manager: EntityManager,
    edlId: string,
  ): Promise<void> {
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
    if (edl.statut === StatutEtatDesLieux.SIGNED) {
      throw new ConflictException({
        message: 'Ce document est déjà signé : il ne peut plus être modifié.',
        code: CODE_DEJA_SIGNE,
      });
    }
    if (edl.statut !== StatutEtatDesLieux.DRAFT) {
      throw new ConflictException({
        message:
          'Ce document est validé : les éléments ne sont plus modifiables, il ne reste qu’à le signer.',
        code: CODE_NON_MODIFIABLE,
      });
    }
  }

  private photosDe(
    manager: EntityManager,
    elementId: string,
  ): Promise<EdlPhoto[]> {
    return manager.find(EdlPhoto, {
      where: { elementId },
      order: { createdAt: 'ASC' },
    });
  }

  private champsModifies(
    avant: InstantaneElement,
    apres: InstantaneElement,
  ): string {
    return (Object.keys(apres) as (keyof InstantaneElement)[])
      .filter((champ) => apres[champ] !== avant[champ])
      .join(', ');
  }

  /** Entrée de référence d'une sortie : celle demandée, sinon la dernière signée du locataire. */
  private async resoudreReference(
    locataireId: number,
    etatEntreeRefId?: string,
  ): Promise<EtatDesLieux | null> {
    if (etatEntreeRefId) {
      const reference = await this.repository.findOne({
        where: { id: etatEntreeRefId },
        relations: { pieces: { elements: true } },
      });

      if (
        !reference ||
        reference.locataireId !== locataireId ||
        reference.type !== TypeEtatDesLieux.ENTREE ||
        reference.statut !== StatutEtatDesLieux.SIGNED
      ) {
        throw new BadRequestException(
          "etatEntreeRefId doit désigner un état des lieux d'entrée signé de ce locataire.",
        );
      }

      return reference;
    }

    return this.repository.findOne({
      where: {
        locataireId,
        type: TypeEtatDesLieux.ENTREE,
        statut: StatutEtatDesLieux.SIGNED,
      },
      relations: { pieces: { elements: true } },
      order: { dateSignature: 'DESC' },
    });
  }

  /**
   * Compose les pièces du nouveau document :
   *   - pièces fournies par le bailleur, sinon celles de l'entrée de référence,
   *     sinon le modèle par défaut ;
   *   - pour une sortie, chaque élément retrouvé dans l'entrée en reprend la
   *     valeur retenue (état + commentaire) comme référence.
   */
  private construirePieces(
    fournies: PieceModeleDto[] | undefined,
    reference: EtatDesLieux | null,
  ): EtatDesLieux['pieces'] {
    const entree = new Map<string, EdlElement>();
    for (const piece of reference?.pieces ?? []) {
      for (const element of piece.elements ?? []) {
        entree.set(cle(piece.nom, element.nom), element);
      }
    }

    const modele: PieceModeleDto[] =
      fournies ??
      (reference
        ? [...reference.pieces]
            .sort((a, b) => a.ordre - b.ordre)
            .map((piece) => ({
              nom: piece.nom,
              elements: [...piece.elements]
                .sort((a, b) => a.ordre - b.ordre)
                .map((element) => ({ nom: element.nom })),
            }))
        : PIECES_PAR_DEFAUT);

    return modele.map((piece, indexPiece) => ({
      nom: piece.nom,
      ordre: indexPiece,
      elements: piece.elements.map((element, indexElement) => {
        const refElement = entree.get(cle(piece.nom, element.nom));
        const retenue = refElement ? valeurRetenue(refElement) : null;

        return {
          nom: element.nom,
          ordre: indexElement,
          elementEntreeRefId: refElement?.id ?? null,
          etatBailleur: retenue?.etat ?? element.etatBailleur ?? null,
          commentaireBailleur:
            retenue?.commentaire ?? element.commentaireBailleur ?? null,
        };
      }),
    })) as EtatDesLieux['pieces'];
  }

  private async versLien(edl: EtatDesLieux): Promise<LienEtatDesLieux> {
    const token = await this.tokens.signer(
      edl.id,
      edl.lienJti,
      edl.lienExpireLe,
    );

    return {
      id: edl.id,
      lien: this.tokens.construireLien(token),
      expireLe: edl.lienExpireLe.toISOString(),
    };
  }
}
