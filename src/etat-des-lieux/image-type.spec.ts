import { detecterTypeImage } from './image-type';

describe('detecterTypeImage', () => {
  it('reconnaît JPEG, PNG et WebP à leurs premiers octets', () => {
    expect(detecterTypeImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe(
      'image/jpeg',
    );
    expect(
      detecterTypeImage(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
      ),
    ).toBe('image/png');
    expect(
      detecterTypeImage(
        Buffer.concat([
          Buffer.from('RIFF'),
          Buffer.alloc(4),
          Buffer.from('WEBPVP8 '),
        ]),
      ),
    ).toBe('image/webp');
  });

  it('refuse tout le reste, quel que soit le nom du fichier', () => {
    expect(
      detecterTypeImage(Buffer.from('MZ\x90\x00 programme windows')),
    ).toBeNull();
    expect(
      detecterTypeImage(Buffer.from('<svg onload="alert(1)"/>')),
    ).toBeNull();
    expect(detecterTypeImage(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(detecterTypeImage(Buffer.from('GIF89a'))).toBeNull();
  });

  it('refuse un fichier vide ou tronqué', () => {
    expect(detecterTypeImage(Buffer.alloc(0))).toBeNull();
    expect(detecterTypeImage(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detecterTypeImage(Buffer.from('RIFF'))).toBeNull();
  });
});
