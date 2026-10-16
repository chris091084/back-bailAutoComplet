export type TypeImage = 'image/jpeg' | 'image/png' | 'image/webp';

export const EXTENSIONS: Record<TypeImage, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Reconnaît une image par ses PREMIERS OCTETS (« nombre magique »), pas par le
 * type MIME annoncé par le client : celui-ci est librement falsifiable, un
 * fichier `.exe` renommé `.jpg` passerait sinon.
 */
export function detecterTypeImage(contenu: Buffer): TypeImage | null {
  if (
    contenu.length >= 3 &&
    contenu[0] === 0xff &&
    contenu[1] === 0xd8 &&
    contenu[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    contenu.length >= 8 &&
    contenu
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }

  if (
    contenu.length >= 12 &&
    contenu.subarray(0, 4).toString('latin1') === 'RIFF' &&
    contenu.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}
