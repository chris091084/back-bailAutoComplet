import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * La conversion elle-même n'est pas exercée ici : elle réclame un LibreOffice
 * installé, absent des machines de développement comme de l'intégration
 * continue. Ce qui est vérifié, c'est le contrat de la route — garde, format
 * accepté, en-têtes de la réponse.
 */
describe('DocumentsController', () => {
  let app: INestApplication;
  const documentsService = {
    convertirEnPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7 …')),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: documentsService }],
    })
      // Le vrai garde exige un jeton signé : le parcours d'authentification a
      // ses propres tests.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    await app.init();
    documentsService.convertirEnPdf.mockClear();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rend un PDF et le nomme d’après le document reçu', async () => {
    const reponse = await request(app.getHttpServer())
      .post('/documents/pdf')
      .attach('document', Buffer.from('docx factice'), {
        filename: 'Quittance_2026-01_DUPONT_Marie.docx',
        contentType: DOCX_MIME,
      })
      .expect(201);

    expect(reponse.headers['content-type']).toContain('application/pdf');
    expect(reponse.headers['content-disposition']).toContain(
      'Quittance_2026-01_DUPONT_Marie.pdf',
    );
    expect(documentsService.convertirEnPdf).toHaveBeenCalledTimes(1);
  });

  it('refuse un fichier qui n’est pas un .docx', async () => {
    await request(app.getHttpServer())
      .post('/documents/pdf')
      .attach('document', Buffer.from('%PDF-1.7'), {
        filename: 'deja.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(documentsService.convertirEnPdf).not.toHaveBeenCalled();
  });

  it('refuse une requête sans document', async () => {
    await request(app.getHttpServer()).post('/documents/pdf').expect(400);

    expect(documentsService.convertirEnPdf).not.toHaveBeenCalled();
  });
});
