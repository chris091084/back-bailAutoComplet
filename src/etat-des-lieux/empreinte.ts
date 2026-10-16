import { createHash } from 'node:crypto';
import { EtatDesLieux } from './etat-des-lieux.entity';

const sha256 = (texte: string | Buffer): string =>
  createHash('sha256').update(texte).digest('hex');

/**
 * Empreinte (SHA-256) du contenu d'un état des lieux : tout ce qui constitue le
 * constat — infos, éléments, saisies, photos (par identifiant) — et les
 * signatures (par leur propre empreinte), dans un ordre fixe.
 *
 * Calculée au moment de signer et imprimée sur le PDF : si un seul mot du
 * document changeait ensuite en base, l'empreinte recalculée ne correspondrait
 * plus. C'est une preuve d'intégrité, pas une signature qualifiée eIDAS.
 */
export function calculerEmpreinte(edl: EtatDesLieux): string {
  const contenu = {
    id: edl.id,
    type: edl.type,
    locataireId: edl.locataireId,
    appartementId: edl.appartementId,
    adresse: edl.adresse,
    chauffage: edl.chauffage,
    clesRemises: edl.clesRemises,
    dateSignature: edl.dateSignature?.toISOString() ?? null,
    signatureBailleur: edl.signatureBailleur
      ? sha256(edl.signatureBailleur)
      : null,
    signatureLocataire: edl.signatureLocataire
      ? sha256(edl.signatureLocataire)
      : null,
    pieces: [...(edl.pieces ?? [])]
      .sort((a, b) => a.ordre - b.ordre)
      .map((piece) => ({
        nom: piece.nom,
        elements: [...(piece.elements ?? [])]
          .sort((a, b) => a.ordre - b.ordre)
          .map((element) => ({
            nom: element.nom,
            etatBailleur: element.etatBailleur,
            commentaireBailleur: element.commentaireBailleur,
            etatLocataire: element.etatLocataire,
            commentaireLocataire: element.commentaireLocataire,
            dateModifLocataire:
              element.dateModifLocataire?.toISOString() ?? null,
            statutValidation: element.statutValidation,
            photos: [...(element.photos ?? [])].map((p) => p.id).sort(),
          })),
      })),
  };

  return sha256(JSON.stringify(contenu));
}
