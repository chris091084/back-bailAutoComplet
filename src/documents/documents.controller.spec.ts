import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MailService } from '../mail/mail.service';
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
  const mailService = {
    envoyer: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: documentsService },
        { provide: MailService, useValue: mailService },
      ],
    })
      // Le vrai garde exige un jeton signé : le parcours d'authentification a
      // ses propres tests.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    await app.init();
    documentsService.convertirEnPdf.mockClear();
    mailService.envoyer.mockClear();
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

  describe('POST /documents/envoyer', () => {
    /** Requête valide, prête à recevoir ses documents. */
    const envoi = () =>
      request(app.getHttpServer())
        .post('/documents/envoyer')
        .field('to', 'marie.dupont@example.com')
        .field('subject', 'Quittances de loyer')
        .field('text', 'Bonjour Marie,');

    const docx = (nom: string) =>
      [Buffer.from(`docx ${nom}`), { filename: nom, contentType: DOCX_MIME }] as const;

    it('convertit chaque document et les envoie dans un seul mail', async () => {
      await envoi()
        .attach('documents', ...docx('Quittance_2026-01_DUPONT_Marie.pdf'))
        .attach('documents', ...docx('Quittance_2026-02_DUPONT_Marie.pdf'))
        .expect(204);

      expect(documentsService.convertirEnPdf).toHaveBeenCalledTimes(2);
      expect(mailService.envoyer).toHaveBeenCalledTimes(1);
      expect(mailService.envoyer).toHaveBeenCalledWith({
        to: 'marie.dupont@example.com',
        subject: 'Quittances de loyer',
        text: 'Bonjour Marie,',
        attachments: [
          {
            filename: 'Quittance_2026-01_DUPONT_Marie.pdf',
            content: Buffer.from('%PDF-1.7 …'),
          },
          {
            filename: 'Quittance_2026-02_DUPONT_Marie.pdf',
            content: Buffer.from('%PDF-1.7 …'),
          },
        ],
      });
    });

    it('refuse tout l’envoi si un document n’est pas un .docx', async () => {
      await envoi()
        .attach('documents', ...docx('Quittance_2026-01_DUPONT_Marie.pdf'))
        .attach('documents', Buffer.from('%PDF-1.7'), {
          filename: 'deja.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);

      expect(documentsService.convertirEnPdf).not.toHaveBeenCalled();
      expect(mailService.envoyer).not.toHaveBeenCalled();
    });

    it('refuse un destinataire qui n’est pas une adresse email', async () => {
      await request(app.getHttpServer())
        .post('/documents/envoyer')
        .field('to', 'pas-une-adresse')
        .field('subject', 'Quittances de loyer')
        .field('text', 'Bonjour Marie,')
        .attach('documents', ...docx('Quittance_2026-01_DUPONT_Marie.pdf'))
        .expect(400);

      expect(documentsService.convertirEnPdf).not.toHaveBeenCalled();
    });

    it('refuse un envoi sans document', async () => {
      await envoi().expect(400);

      expect(mailService.envoyer).not.toHaveBeenCalled();
    });

    it('refuse plus de douze documents', async () => {
      let requete = envoi();
      for (let mois = 1; mois <= 13; mois++) {
        requete = requete.attach('documents', ...docx(`Quittance_${mois}.pdf`));
      }

      await requete.expect(400);

      expect(documentsService.convertirEnPdf).not.toHaveBeenCalled();
      expect(mailService.envoyer).not.toHaveBeenCalled();
    });
  });
});
