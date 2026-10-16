import { EdlElement } from '../edl-element.entity';
import { EdlPhoto } from '../edl-photo.entity';
import { EdlPiece } from '../edl-piece.entity';
import { EtatDesLieux } from '../etat-des-lieux.entity';
import {
  StatutEtatDesLieux,
  StatutSyncPhoto,
  StatutValidation,
  TypeEtatDesLieux,
} from '../etat-des-lieux.enums';
import { EtatElement } from '../etat-element.enum';
import { anneesConservation } from '../edl-retention.config';

export interface PhotoReponse {
  id: string;
  statutSync: StatutSyncPhoto;
  creeLe: string;
}

export interface ElementReponse {
  id: string;
  nom: string;
  ordre: number;
  etatBailleur: EtatElement | null;
  commentaireBailleur: string | null;
  etatLocataire: EtatElement | null;
  commentaireLocataire: string | null;
  dateModifLocataire: string | null;
  statutValidation: StatutValidation;
  /** Dernière écriture, à l'heure du serveur. */
  updatedAt: string;
  photos: PhotoReponse[];
}

export interface PieceReponse {
  id: string;
  nom: string;
  ordre: number;
  elements: ElementReponse[];
}

export interface EtatDesLieuxReponse {
  id: string;
  type: TypeEtatDesLieux;
  statut: StatutEtatDesLieux;
  dateCreation: string;
  dateSignature: string | null;
  /** Sortie sans état d'entrée de référence : le front affiche « Aucune référence ». */
  referenceDisponible: boolean;
  infos: {
    adresse: string;
    chauffage: string | null;
    clesRemises: string | null;
  };
  locataire: { prenom: string; nom: string };
  /** Responsable du traitement (mention RGPD affichée en tête du formulaire). */
  bailleur: { nom: string; email: string; telephone: string } | null;
  lienExpireLe: string;
  /** Années de conservation après la fin du bail (mention RGPD affichée au locataire). */
  conservationAnnees: number;
  pieces: PieceReponse[];
}

const parOrdre = <T extends { ordre: number }>(a: T, b: T): number =>
  a.ordre - b.ordre;

export const versPhotoReponse = (photo: EdlPhoto): PhotoReponse => ({
  id: photo.id,
  statutSync: photo.statutSync,
  creeLe: photo.createdAt.toISOString(),
});

export const versElementReponse = (element: EdlElement): ElementReponse => ({
  id: element.id,
  nom: element.nom,
  ordre: element.ordre,
  etatBailleur: element.etatBailleur,
  commentaireBailleur: element.commentaireBailleur,
  etatLocataire: element.etatLocataire,
  commentaireLocataire: element.commentaireLocataire,
  dateModifLocataire: element.dateModifLocataire?.toISOString() ?? null,
  statutValidation: element.statutValidation,
  updatedAt: element.updatedAt.toISOString(),
  photos: [...(element.photos ?? [])]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(versPhotoReponse),
});

export const versPieceReponse = (piece: EdlPiece): PieceReponse => ({
  id: piece.id,
  nom: piece.nom,
  ordre: piece.ordre,
  elements: [...(piece.elements ?? [])].sort(parOrdre).map(versElementReponse),
});

export const versEtatDesLieuxReponse = (
  edl: EtatDesLieux,
): EtatDesLieuxReponse => {
  const bailleur = edl.appartement?.bailleur;

  return {
    id: edl.id,
    type: edl.type,
    statut: edl.statut,
    dateCreation: edl.dateCreation.toISOString(),
    dateSignature: edl.dateSignature?.toISOString() ?? null,
    referenceDisponible:
      edl.type === TypeEtatDesLieux.SORTIE && edl.etatEntreeRefId !== null,
    infos: {
      adresse: edl.adresse,
      chauffage: edl.chauffage,
      clesRemises: edl.clesRemises,
    },
    locataire: { prenom: edl.locataire.prenom, nom: edl.locataire.nom },
    bailleur: bailleur
      ? {
          nom: bailleur.name,
          email: bailleur.email,
          telephone: bailleur.telephone,
        }
      : null,
    lienExpireLe: edl.lienExpireLe.toISOString(),
    conservationAnnees: anneesConservation(),
    pieces: [...(edl.pieces ?? [])].sort(parOrdre).map(versPieceReponse),
  };
};

/** Ligne de la liste côté bailleur : l'avancement sans le détail des pièces. */
export interface EtatDesLieuxResume {
  id: string;
  type: TypeEtatDesLieux;
  statut: StatutEtatDesLieux;
  locataireId: number;
  appartementId: number;
  dateCreation: string;
  dateSignature: string | null;
  elementsValides: number;
  elementsTotal: number;
}

export const versResume = (edl: EtatDesLieux): EtatDesLieuxResume => {
  const elements = (edl.pieces ?? []).flatMap((p) => p.elements ?? []);

  return {
    id: edl.id,
    type: edl.type,
    statut: edl.statut,
    locataireId: edl.locataireId,
    appartementId: edl.appartementId,
    dateCreation: edl.dateCreation.toISOString(),
    dateSignature: edl.dateSignature?.toISOString() ?? null,
    elementsValides: elements.filter(
      (e) => e.statutValidation === StatutValidation.VALIDE,
    ).length,
    elementsTotal: elements.length,
  };
};
