import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const convertWithOptions = jest.fn();

jest.mock('libreoffice-convert', () => ({
  convertWithOptions: (...args: unknown[]) => convertWithOptions(...args),
}));

// Importé après le mock : le service promisifie `convertWithOptions` au
// chargement du module.
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { DocumentsService } from './documents.service';

type Rappel = (erreur: Error | null, pdf?: Buffer) => void;

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeEach(() => {
    convertWithOptions.mockReset();
    service = new DocumentsService(new ConfigService());
  });

  it('convertit un document en PDF', async () => {
    convertWithOptions.mockImplementation(
      (...args: unknown[]) =>
        (args[4] as Rappel)(null, Buffer.from('%PDF-1.7')),
    );

    const pdf = await service.convertirEnPdf(
      Buffer.from('docx'),
      'Quittance.docx',
    );

    expect(pdf.toString()).toBe('%PDF-1.7');
  });

  it('n’exécute qu’une conversion à la fois', async () => {
    let enCours = 0;
    let simultaneesMax = 0;

    convertWithOptions.mockImplementation((...args: unknown[]) => {
      enCours += 1;
      simultaneesMax = Math.max(simultaneesMax, enCours);
      setTimeout(() => {
        enCours -= 1;
        (args[4] as Rappel)(null, Buffer.from('%PDF-1.7'));
      }, 10);
    });

    await Promise.all(
      ['a', 'b', 'c', 'd'].map((nom) =>
        service.convertirEnPdf(Buffer.from('docx'), `${nom}.docx`),
      ),
    );

    // Deux LibreOffice en parallèle dépasseraient la mémoire du conteneur.
    expect(simultaneesMax).toBe(1);
    expect(convertWithOptions).toHaveBeenCalledTimes(4);
  });

  it('laisse passer les conversions suivantes après un échec', async () => {
    convertWithOptions.mockImplementationOnce((...args: unknown[]) =>
      (args[4] as Rappel)(new Error('soffice absent')),
    );
    convertWithOptions.mockImplementation(
      (...args: unknown[]) =>
        (args[4] as Rappel)(null, Buffer.from('%PDF-1.7')),
    );

    await expect(
      service.convertirEnPdf(Buffer.from('docx'), 'echec.docx'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    const pdf = await service.convertirEnPdf(
      Buffer.from('docx'),
      'suivante.docx',
    );
    expect(pdf.toString()).toBe('%PDF-1.7');
  });
});
