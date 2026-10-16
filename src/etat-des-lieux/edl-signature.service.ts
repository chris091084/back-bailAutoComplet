import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { construireDossier } from '../onedrive/onedrive-chemin';
import { OneDriveService } from '../onedrive/onedrive.service';
import { SignerDto } from './dto/signer.dto';
import { EdlElement } from './edl-element.entity';
import { EdlPdfService, dateLongue } from './edl-pdf.service';
import { EdlTokenService } from './edl-token.service';
import { elementsNonTraites } from './element-regles';
import { calculerEmpreinte } from './empreinte';
import { EtatDesLieux } from './etat-des-lieux.entity';
import { StatutEtatDesLieux, TypeEtatDesLieux } from './etat-des-lieux.enums';
import { CODE_NON_MODIFIABLE } from './etat-des-lieux.service';
import { CODE_DEJA_SIGNE } from './guards/edl-token.guard';
import { normaliserSignature } from './signature';

export const CODE_ELEMENTS_MANQUANTS = 'ELEMENTS_MANQUANTS';
export const CODE_PAS_SIGNE = 'PAS_SIGNE';

export interface ElementManquant {
  pieceNom: string;
  elementId: string;
  elementNom: string;
}

/** Ce qui s'est passé APRÈS la signature (qui, elle, est acquise). */
export interface SuitesSignature {
  /** Le PDF a pu être fabriqué. */
  pdf: boolean;
  /** Il a été envoyé par e-mail à au moins une des deux parties. */
  emailLocataire: boolean;
  emailBailleur: boolean;
  /** Il est archivé dans le OneDrive du bailleur. */
  archive: boolean;
}

export interface ResultatSignature extends SuitesSignature {
  statut: StatutEtatDesLieux;
  dateSignature: string;
}

const libelleType = (type: TypeEtatDesLieux): string =>
  type === TypeEtatDesLieux.SORTIE ? 'de sortie' : 'd’entrée';

/**
 * Fin de vie du document : validation globale, signature, puis PDF + e-mails +
 * archivage. La SIGNATURE est une transaction courte qui verrouille tout ; ce qui
 * suit (PDF, e-mails, OneDrive) dépend de services externes et peut échouer sans
 * remettre en cause la signature — d'où `renvoyer`, qui rejoue ces étapes.
 */
@Injectable()
export class EdlSignatureService {
  private readonly logger = new Logger('EtatDesLieux');

  constructor(
    @InjectRepository(EtatDesLieux)
    private readonly repository: Repository<EtatDesLieux>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly pdf: EdlPdfService,
    private readonly mail: MailService,
    private readonly oneDrive: OneDriveService,
    private readonly tokens: EdlTokenService,
  ) {}

  /**
   * Validation globale : tous les éléments sont traités, sinon 422 avec la
   * liste de ce qui manque. Passe le document à `validated` (éléments
   * verrouillés, il ne reste qu'à signer). Idempotente.
   */
  async valider(edlId: string): Promise<{ statut: StatutEtatDesLieux }> {
    return this.dataSource.transaction(async (manager) => {
      const edl = await this.verrouiller(manager, edlId);
      if (edl.statut === StatutEtatDesLieux.VALIDATED) {
        return { statut: edl.statut };
      }

      await this.exigerComplet(manager, edlId);
      edl.statut = StatutEtatDesLieux.VALIDATED;
      await manager.save(edl);
      this.logger.log(`Document ${edlId} validé par le locataire`);
      return { statut: edl.statut };
    });
  }

  async signer(edlId: string, dto: SignerDto): Promise<ResultatSignature> {
    // Contrôles de forme AVANT de toucher la base : une signature invalide ne
    // doit rien verrouiller.
    const signatureLocataire = normaliserSignature(
      dto.signatureLocataire,
      'La signature du locataire',
    );
    const signatureBailleur = dto.signatureBailleur
      ? normaliserSignature(dto.signatureBailleur, 'La signature du bailleur')
      : null;

    const dateSignature = await this.dataSource.transaction(async (manager) => {
      const edl = await this.verrouiller(manager, edlId);
      await this.exigerComplet(manager, edlId);

      edl.signatureLocataire = signatureLocataire;
      edl.signatureBailleur = signatureBailleur;
      edl.dateSignature = new Date();
      edl.statut = StatutEtatDesLieux.SIGNED;
      await manager.save(edl);

      // L'empreinte porte sur le document TEL QUE signé : on le relit en entier.
      const complet = await manager.findOneOrFail(EtatDesLieux, {
        where: { id: edlId },
        relations: { pieces: { elements: { photos: true } } },
      });
      complet.empreinte = calculerEmpreinte(complet);
      await manager.save(complet);

      return complet.dateSignature as Date;
    });

    // Ni signature ni contenu dans les logs : seulement le fait.
    this.logger.log(
      `Document ${edlId} signé (${signatureBailleur ? '2' : '1'} signature(s))`,
    );

    const suites = await this.finaliser(edlId);
    return {
      statut: StatutEtatDesLieux.SIGNED,
      dateSignature: dateSignature.toISOString(),
      ...suites,
    };
  }

  /**
   * Rejoue PDF + e-mails + archivage d'un document SIGNÉ (échec d'envoi, adresse
   * corrigée…). L'archive n'est refaite que si elle manque.
   */
  async renvoyer(edlId: string): Promise<SuitesSignature> {
    const edl = await this.repository.findOneBy({ id: edlId });
    if (!edl) {
      throw new NotFoundException('État des lieux introuvable');
    }
    if (edl.statut !== StatutEtatDesLieux.SIGNED) {
      throw new ConflictException({
        message: 'Seul un document signé peut être renvoyé.',
        code: CODE_PAS_SIGNE,
      });
    }

    return this.finaliser(edlId);
  }

  /** Le locataire n'a rien à rouvrir tout seul : c'est le bailleur qui lève la validation. */
  async rouvrir(edlId: string): Promise<{ statut: StatutEtatDesLieux }> {
    return this.dataSource.transaction(async (manager) => {
      const edl = await this.verrouiller(manager, edlId, {
        signeInterdit: true,
      });
      edl.statut = StatutEtatDesLieux.DRAFT;
      await manager.save(edl);
      this.logger.log(`Document ${edlId} rouvert par le bailleur`);
      return { statut: edl.statut };
    });
  }

  /** E-mail du lien au locataire. `sansCopie` : le lien est un secret, la copie cachée d'archivage ne doit pas le recevoir. */
  async envoyerLien(edlId: string): Promise<{ envoyeA: string }> {
    const edl = await this.repository.findOne({
      where: { id: edlId },
      relations: { locataire: true, appartement: { bailleur: true } },
    });
    if (!edl) {
      throw new NotFoundException('État des lieux introuvable');
    }
    if (edl.statut === StatutEtatDesLieux.SIGNED) {
      throw new ConflictException({
        message: 'Ce document est déjà signé.',
        code: CODE_DEJA_SIGNE,
      });
    }
    if (!edl.locataire.email) {
      throw new UnprocessableEntityException(
        'Le locataire n’a pas d’adresse e-mail : renseignez-la sur sa fiche, ou copiez le lien.',
      );
    }

    const token = await this.tokens.signer(
      edl.id,
      edl.lienJti,
      edl.lienExpireLe,
    );
    const lien = this.tokens.construireLien(token);

    await this.mail.envoyer({
      to: edl.locataire.email,
      subject: `État des lieux ${libelleType(edl.type)} — ${edl.adresse}`,
      text: [
        `Bonjour ${edl.locataire.prenom},`,
        '',
        `Merci de remplir l’état des lieux ${libelleType(edl.type)} du logement situé ${edl.adresse}.`,
        'Cela se fait depuis votre téléphone ou votre ordinateur, sans créer de compte :',
        '',
        lien,
        '',
        `Ce lien est personnel et valable jusqu’au ${dateLongue(edl.lienExpireLe)}.`,
        'Pour chaque élément, validez d’un clic ou modifiez, puis signez à la fin.',
        '',
        'Cordialement,',
        edl.appartement.bailleur?.name ?? '',
      ].join('\n'),
      sansCopie: true,
    });

    this.logger.log(`Lien de ${edlId} envoyé par e-mail`);
    return { envoyeA: edl.locataire.email };
  }

  // ----------------------------------------------------------------- interne

  /**
   * PDF, archive, e-mails. Chaque étape est isolée : l'échec de l'une n'empêche
   * pas les autres, et rien ne remonte comme erreur — la signature est acquise,
   * on rend compte de ce qui a marché.
   */
  private async finaliser(edlId: string): Promise<SuitesSignature> {
    const suites: SuitesSignature = {
      pdf: false,
      emailLocataire: false,
      emailBailleur: false,
      archive: false,
    };

    const edl = await this.repository.findOne({
      where: { id: edlId },
      relations: { locataire: true, appartement: { bailleur: true } },
    });
    if (!edl) {
      return suites;
    }

    let contenu: Buffer;
    try {
      contenu = await this.pdf.generer(edlId);
      suites.pdf = true;
    } catch (erreur) {
      // Le message seulement : ni le HTML du document ni ses données ne sont journalisés.
      this.logger.error(
        `PDF impossible pour ${edlId} (${erreur instanceof Error ? erreur.message : 'erreur inconnue'}) : e-mails et archive reportés`,
      );
      return suites;
    }

    const nomFichier = this.pdf.nomFichier(edl);

    if (!edl.pdfOneDriveItemId) {
      try {
        const dossier = construireDossier({
          adresse: edl.adresse,
          locataire: `${edl.locataire.nom} ${edl.locataire.prenom}`,
          type: edl.type === TypeEtatDesLieux.SORTIE ? 'sortie' : 'entree',
        });
        const fichier = await this.oneDrive.televerser(
          `${dossier}/${nomFichier}`,
          contenu,
          'application/pdf',
        );
        await this.repository.update(
          { id: edlId },
          { pdfOneDriveItemId: fichier.itemId },
        );
        suites.archive = true;
      } catch {
        this.logger.warn(
          `Archive OneDrive du PDF de ${edlId} impossible (sera retentée au renvoi)`,
        );
      }
    } else {
      suites.archive = true;
    }

    const bailleur = edl.appartement.bailleur;
    const quand = edl.dateSignature ? dateLongue(edl.dateSignature) : '';
    const pieceJointe = [{ filename: nomFichier, content: contenu }];

    if (edl.locataire.email) {
      suites.emailLocataire = await this.envoyerMail({
        to: edl.locataire.email,
        subject: `État des lieux ${libelleType(edl.type)} signé — ${edl.adresse}`,
        text: [
          `Bonjour ${edl.locataire.prenom},`,
          '',
          `Vous trouverez ci-joint, en PDF, l’état des lieux ${libelleType(edl.type)} du logement situé ${edl.adresse}, signé le ${quand}.`,
          '',
          'Conservez ce document : il fait foi de l’état du logement.',
          '',
          'Cordialement,',
          bailleur?.name ?? '',
        ].join('\n'),
        attachments: pieceJointe,
      });
    }

    if (bailleur?.email) {
      suites.emailBailleur = await this.envoyerMail({
        to: bailleur.email,
        subject: `État des lieux ${libelleType(edl.type)} signé — ${edl.locataire.prenom} ${edl.locataire.nom}`,
        text: [
          `L’état des lieux ${libelleType(edl.type)} de ${edl.locataire.prenom} ${edl.locataire.nom} (${edl.adresse}) a été signé le ${quand}.`,
          '',
          'Le PDF est en pièce jointe.',
          suites.archive
            ? 'Il est aussi archivé dans votre OneDrive, avec les photos.'
            : 'Son archivage dans votre OneDrive n’a pas pu se faire : vérifiez la connexion OneDrive puis renvoyez le document.',
        ].join('\n'),
        attachments: pieceJointe,
      });
    }

    if (suites.emailLocataire || suites.emailBailleur) {
      await this.repository.update({ id: edlId }, { pdfEnvoyeLe: new Date() });
    }

    return suites;
  }

  /** Un échec d'envoi ne doit pas empêcher l'autre destinataire de recevoir le sien. */
  private async envoyerMail(
    message: Parameters<MailService['envoyer']>[0],
  ): Promise<boolean> {
    try {
      await this.mail.envoyer(message);
      return true;
    } catch {
      // `MailService` a déjà journalisé la cause ; on ne répète pas l'adresse.
      return false;
    }
  }

  /** Verrou exclusif sur le document, et contrôle qu'il peut encore bouger. */
  private async verrouiller(
    manager: EntityManager,
    edlId: string,
    options: { signeInterdit?: boolean } = {},
  ): Promise<EtatDesLieux> {
    const edl = await manager
      .getRepository(EtatDesLieux)
      .createQueryBuilder('edl')
      .where('edl.id = :edlId', { edlId })
      .setLock('pessimistic_write')
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
    if (options.signeInterdit && edl.statut === StatutEtatDesLieux.DRAFT) {
      throw new ConflictException({
        message: 'Ce document n’est pas validé : rien à rouvrir.',
        code: CODE_NON_MODIFIABLE,
      });
    }

    return edl;
  }

  /** Tous les éléments sont traités, sinon 422 et la liste de ceux qui manquent. */
  private async exigerComplet(
    manager: EntityManager,
    edlId: string,
  ): Promise<void> {
    const elements = await manager
      .getRepository(EdlElement)
      .createQueryBuilder('element')
      .innerJoinAndSelect('element.piece', 'piece')
      .where('piece.etatDesLieuxId = :edlId', { edlId })
      .orderBy('piece.ordre', 'ASC')
      .addOrderBy('element.ordre', 'ASC')
      .getMany();

    const manquants = elementsNonTraites(elements);
    if (manquants.length === 0) {
      return;
    }

    throw new UnprocessableEntityException({
      message: `${manquants.length} élément(s) restent à traiter.`,
      code: CODE_ELEMENTS_MANQUANTS,
      manquants: manquants.map((element): ElementManquant => ({
        pieceNom: element.piece.nom,
        elementId: element.id,
        elementNom: element.nom,
      })),
    });
  }
}
