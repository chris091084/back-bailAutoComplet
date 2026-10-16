import { UnprocessableEntityException } from '@nestjs/common';
import {
  SIGNATURE_MAX_OCTETS,
  normaliserSignature,
  versDataUrlPng,
} from './signature';

const PNG_ENTETE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const png = (octetsEnPlus = 20) =>
  Buffer.concat([PNG_ENTETE, Buffer.alloc(octetsEnPlus, 7)]).toString('base64');

describe('normaliserSignature', () => {
  it('accepte un PNG en base64 nu', () => {
    expect(normaliserSignature(png(), 'La signature')).toBe(png());
  });

  it('retire le préfixe data: et les retours à la ligne', () => {
    const base64 = png();
    const avecPrefixe = `data:image/png;base64,${base64.slice(0, 10)}\n${base64.slice(10)}`;

    expect(normaliserSignature(avecPrefixe, 'La signature')).toBe(base64);
  });

  it('refuse ce qui n’est pas un PNG, quel que soit le préfixe annoncé', () => {
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0,
    ]).toString('base64');
    const script = Buffer.from('<script>alert(1)</script>').toString('base64');

    for (const mauvais of [jpeg, script, `data:image/png;base64,${jpeg}`]) {
      expect(() => normaliserSignature(mauvais, 'La signature')).toThrow(
        UnprocessableEntityException,
      );
    }
  });

  it('refuse du texte qui n’est pas du base64', () => {
    expect(() =>
      normaliserSignature('pas du base64 !!', 'La signature'),
    ).toThrow(/base64/);
    expect(() => normaliserSignature('', 'La signature')).toThrow(
      UnprocessableEntityException,
    );
  });

  it('refuse une image trop lourde', () => {
    expect(() =>
      normaliserSignature(png(SIGNATURE_MAX_OCTETS), 'La signature'),
    ).toThrow(/volumineuse/);
  });

  it('nomme la signature fautive dans le message', () => {
    expect(() => normaliserSignature('xx', 'La signature du bailleur')).toThrow(
      /La signature du bailleur/,
    );
  });

  it('reconstruit une URL de données pour le PDF', () => {
    expect(versDataUrlPng('AAA')).toBe('data:image/png;base64,AAA');
  });
});
