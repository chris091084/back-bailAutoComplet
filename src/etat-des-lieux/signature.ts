import { UnprocessableEntityException } from '@nestjs/common';

/** Une signature manuscrite, dessinée sur un écran, pèse quelques dizaines de ko. */
export const SIGNATURE_MAX_OCTETS = 200 * 1024;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PREFIXE_DATA_URL = /^data:image\/png;base64,/i;

export const CODE_SIGNATURE_INVALIDE = 'SIGNATURE_INVALIDE';

/**
 * Contrôle une signature reçue (PNG en base64, avec ou sans préfixe `data:`) et
 * renvoie le base64 NU qu'on stocke. On ne fait confiance ni au préfixe ni au
 * nom : ce qui est décodé doit commencer par la signature d'un PNG, et rester
 * sous la taille plafond — c'est un champ texte que n'importe qui peut remplir.
 */
export function normaliserSignature(brut: string, nom: string): string {
  const base64 = brut.replace(PREFIXE_DATA_URL, '').replace(/\s/g, '');

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw invalide(nom, 'n’est pas du base64');
  }

  const octets = Buffer.from(base64, 'base64');
  if (
    octets.length < PNG.length ||
    !octets.subarray(0, PNG.length).equals(PNG)
  ) {
    throw invalide(nom, 'n’est pas une image PNG');
  }
  if (octets.length > SIGNATURE_MAX_OCTETS) {
    throw invalide(nom, 'est trop volumineuse');
  }

  return base64;
}

const invalide = (nom: string, raison: string): UnprocessableEntityException =>
  new UnprocessableEntityException({
    message: `${nom} ${raison}.`,
    code: CODE_SIGNATURE_INVALIDE,
  });

/** Pour l'intégrer à un PDF (balise `<img>`). */
export const versDataUrlPng = (base64: string): string =>
  `data:image/png;base64,${base64}`;
