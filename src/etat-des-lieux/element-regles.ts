import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InstantaneElement } from './edl-element-historique.entity';
import { EdlElement } from './edl-element.entity';
import { StatutValidation } from './etat-des-lieux.enums';
import { EtatElement } from './etat-element.enum';
import { ModifierElementDto } from './dto/modifier-element.dto';

/** Code renvoyé quand le serveur détient une saisie plus récente que celle reçue. */
export const CODE_VERSION_PLUS_RECENTE = 'VERSION_PLUS_RECENTE';

/**
 * Marge acceptée sur l'horloge du téléphone. Au-delà, l'horodatage est ramené à
 * l'heure du serveur : un appareil mal réglé ne doit pas « verrouiller » un
 * élément en s'attribuant une date dans le futur.
 */
const TOLERANCE_HORLOGE_MS = 5 * 60 * 1000;

export const instantane = (element: EdlElement): InstantaneElement => ({
  etatLocataire: element.etatLocataire,
  commentaireLocataire: element.commentaireLocataire,
  statutValidation: element.statutValidation,
});

/** Chaîne vide ou blanche = pas de commentaire, comme `null`. */
const normaliserCommentaire = (valeur: string | null): string | null => {
  const nettoye = valeur?.trim() ?? '';
  return nettoye === '' ? null : nettoye;
};

export interface ResultatModification {
  /** `false` quand la requête n'apporte rien : un rejeu identique ne réécrit rien. */
  modifie: boolean;
  avant: InstantaneElement;
  apres: InstantaneElement;
  horodatage: Date;
}

/**
 * Applique la requête à l'élément (muté en place) et renvoie ce qui a changé.
 *
 * Fonction pure, sans accès à la base, pour que les règles se testent seules :
 *
 *   horodatage client ──┐
 *   horodatage serveur ─┴─► plus ancien que le serveur ? ──oui──► 409 (rien d'écrit)
 *                                   │non
 *                                   ▼
 *              « valide » sans aucun état connu ? ──oui──► 422
 *                                   │non
 *                                   ▼
 *                              écriture
 *
 * Un rejeu du même horodatage n'est PAS un conflit (égal, pas plus récent) :
 * c'est ce qui rend l'écriture idempotente.
 */
export function appliquerModification(
  element: EdlElement,
  dto: ModifierElementDto,
  maintenant: Date,
): ResultatModification {
  const horodatageClient = new Date(dto.modifieLe);
  if (Number.isNaN(horodatageClient.getTime())) {
    throw new UnprocessableEntityException('Horodatage illisible.');
  }

  const touche =
    dto.etatLocataire !== undefined ||
    dto.commentaireLocataire !== undefined ||
    dto.statutValidation !== undefined;
  if (!touche) {
    throw new UnprocessableEntityException(
      'Aucune modification demandée : précisez un état, un commentaire ou un statut.',
    );
  }

  const horodatage = new Date(
    Math.min(
      horodatageClient.getTime(),
      maintenant.getTime() + TOLERANCE_HORLOGE_MS,
    ),
  );

  if (
    element.dateModifLocataire &&
    element.dateModifLocataire.getTime() > horodatage.getTime()
  ) {
    throw new ConflictException({
      message:
        'Une saisie plus récente existe déjà sur le serveur pour cet élément.',
      code: CODE_VERSION_PLUS_RECENTE,
    });
  }

  const avant = instantane(element);

  const etatLocataire =
    dto.etatLocataire === undefined ? element.etatLocataire : dto.etatLocataire;
  const commentaireLocataire =
    dto.commentaireLocataire === undefined
      ? element.commentaireLocataire
      : normaliserCommentaire(dto.commentaireLocataire);
  const statutValidation = dto.statutValidation ?? element.statutValidation;

  // « Valider » sans état = valider du vide. Le dernier mot est le sien, à
  // défaut la référence du bailleur (c'est la coche de validation rapide).
  const etatRetenu: EtatElement | null = etatLocataire ?? element.etatBailleur;
  if (statutValidation === StatutValidation.VALIDE && etatRetenu === null) {
    throw new UnprocessableEntityException(
      'Choisissez un état avant de valider cet élément.',
    );
  }

  const apres: InstantaneElement = {
    etatLocataire,
    commentaireLocataire,
    statutValidation,
  };

  const modifie =
    apres.etatLocataire !== avant.etatLocataire ||
    apres.commentaireLocataire !== avant.commentaireLocataire ||
    apres.statutValidation !== avant.statutValidation;

  if (modifie) {
    element.etatLocataire = etatLocataire;
    element.commentaireLocataire = commentaireLocataire;
    element.statutValidation = statutValidation;
    element.dateModifLocataire = horodatage;
    element.updatedAt = maintenant;
  }

  return { modifie, avant, apres, horodatage };
}

/** Éléments encore à traiter : ce que `validate` renverra comme « manquants ». */
export const elementsNonTraites = (elements: EdlElement[]): EdlElement[] =>
  elements.filter((e) => e.statutValidation !== StatutValidation.VALIDE);
