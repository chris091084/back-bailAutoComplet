import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Locataire } from '../locataire/locataire.entity';
import {
  EdlRetentionService,
  ResultatEffacement,
} from './edl-retention.service';
import { EtatDesLieux } from './etat-des-lieux.entity';

/** Tout ce que le module détient sur un locataire, dans un format lisible par une machine. */
export interface ExportLocataire {
  exporteLe: string;
  locataire: { id: number; nom: string; prenom: string };
  etatsDesLieux: {
    id: string;
    type: string;
    statut: string;
    dateCreation: string;
    dateSignature: string | null;
    adresse: string;
    chauffage: string | null;
    clesRemises: string | null;
    empreinte: string | null;
    /** La signature du locataire (PNG, base64) : c'est une donnée à lui. */
    signatureLocataire: string | null;
    pieces: {
      nom: string;
      elements: {
        nom: string;
        etatBailleur: string | null;
        commentaireBailleur: string | null;
        etatLocataire: string | null;
        commentaireLocataire: string | null;
        dateModifLocataire: string | null;
        statutValidation: string;
        photos: { id: string; creeLe: string; lienOneDrive: string | null }[];
        historique: {
          auteur: string;
          ancienneValeur: unknown;
          nouvelleValeur: unknown;
          creeLe: string;
        }[];
      }[];
    }[];
  }[];
}

/**
 * Droits des personnes (RGPD) sur les données de ce module : accès/portabilité
 * (export) et effacement. Ne concerne QUE les états des lieux : la fiche du
 * locataire et son bail relèvent d'autres modules.
 */
@Injectable()
export class EdlRgpdService {
  private readonly logger = new Logger('Rgpd');

  constructor(
    @InjectRepository(EtatDesLieux)
    private readonly repository: Repository<EtatDesLieux>,
    @InjectRepository(Locataire)
    private readonly locataires: Repository<Locataire>,
    private readonly retention: EdlRetentionService,
  ) {}

  async exporter(locataireId: number): Promise<ExportLocataire> {
    const locataire = await this.locataires.findOneBy({ id: locataireId });
    if (!locataire) {
      throw new NotFoundException(`Locataire ${locataireId} introuvable`);
    }

    const documents = await this.repository.find({
      where: { locataireId },
      relations: { pieces: { elements: { photos: true, historique: true } } },
      order: { dateCreation: 'ASC' },
    });

    this.logger.log(
      `Export des données du locataire ${locataireId} (${documents.length} document(s))`,
    );

    return {
      exporteLe: new Date().toISOString(),
      locataire: {
        id: locataire.id,
        nom: locataire.nom,
        prenom: locataire.prenom,
      },
      etatsDesLieux: documents.map((d) => ({
        id: d.id,
        type: d.type,
        statut: d.statut,
        dateCreation: d.dateCreation.toISOString(),
        dateSignature: d.dateSignature?.toISOString() ?? null,
        adresse: d.adresse,
        chauffage: d.chauffage,
        clesRemises: d.clesRemises,
        empreinte: d.empreinte,
        signatureLocataire: d.signatureLocataire,
        pieces: [...d.pieces]
          .sort((a, b) => a.ordre - b.ordre)
          .map((piece) => ({
            nom: piece.nom,
            elements: [...piece.elements]
              .sort((a, b) => a.ordre - b.ordre)
              .map((e) => ({
                nom: e.nom,
                etatBailleur: e.etatBailleur,
                commentaireBailleur: e.commentaireBailleur,
                etatLocataire: e.etatLocataire,
                commentaireLocataire: e.commentaireLocataire,
                dateModifLocataire: e.dateModifLocataire?.toISOString() ?? null,
                statutValidation: e.statutValidation,
                photos: e.photos.map((p) => ({
                  id: p.id,
                  creeLe: p.createdAt.toISOString(),
                  lienOneDrive: p.oneDriveUrl,
                })),
                historique: [...e.historique]
                  .sort((a, b) => a.creeLe.getTime() - b.creeLe.getTime())
                  .map((h) => ({
                    auteur: h.auteur,
                    ancienneValeur: h.ancienneValeur,
                    nouvelleValeur: h.nouvelleValeur,
                    creeLe: h.creeLe.toISOString(),
                  })),
              })),
          })),
      })),
    };
  }

  /**
   * Droit à l'effacement : tous les états des lieux du locataire, avec leurs
   * photos et leurs PDF dans OneDrive. Un document dont un fichier ne peut pas
   * être supprimé est conservé et compté dans `echecs` : relancer plus tard.
   */
  async effacer(locataireId: number): Promise<ResultatEffacement> {
    const locataire = await this.locataires.findOneBy({ id: locataireId });
    if (!locataire) {
      throw new NotFoundException(`Locataire ${locataireId} introuvable`);
    }

    const documents = await this.repository.find({
      where: { locataireId },
      relations: { pieces: { elements: { photos: true } } },
    });
    const resultat = await this.retention.effacer(documents);

    this.logger.log(
      `Effacement demandé pour le locataire ${locataireId} : ${resultat.documentsSupprimes} document(s) supprimé(s), ${resultat.echecs} échec(s)`,
    );
    return resultat;
  }
}
