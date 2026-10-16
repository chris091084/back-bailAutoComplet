import { INestApplication, LoggerService } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ThrottlerStorage } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { E2E_DB_NAME, recreerBaseE2e } from './e2e-database';
import { CourrierFaux } from './courrier-faux';
import { OneDriveFaux } from './onedrive-faux';

/**
 * Tout ce que l'application journalise pendant la suite de tests, gardé pour le
 * contrôle final (« aucune donnée sensible dans les logs »). Les méthodes sont
 * aussi neutralisées : la sortie des tests reste lisible.
 */
const journal: string[] = [];
const enTexte = (parties: unknown[]): string =>
  parties
    .map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a)))
    .join(' ');

/**
 * Logger de test : garde tout, n'affiche rien. Branché par `setLogger` (le module
 * de test de Nest installe sinon un logger muet, qui laisserait le journal vide).
 */
const capteur: LoggerService = {
  log: (...parties) => void journal.push(enTexte(parties)),
  warn: (...parties) => void journal.push(enTexte(parties)),
  error: (...parties) => void journal.push(enTexte(parties)),
  debug: (...parties) => void journal.push(enTexte(parties)),
  verbose: (...parties) => void journal.push(enTexte(parties)),
  fatal: (...parties) => void journal.push(enTexte(parties)),
};

// Posé AVANT l'import de l'application : les stratégies et la configuration
// lisent l'environnement à leur construction.
process.env.DB_NAME = E2E_DB_NAME;
process.env.DB_MIGRATIONS_RUN = 'true';
process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret-0123456789abcdef012345678';
process.env.EDL_TOKEN_SECRET = 'e2e-edl-secret-0123456789abcdef0123456789abcd';
process.env.EDL_FRONT_BASE_URL = 'http://front.test';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Locataire } from '../src/locataire/locataire.entity';
import { OneDriveIndisponibleError } from '../src/onedrive/onedrive.errors';
import { OneDriveService } from '../src/onedrive/onedrive.service';
import { EdlRetentionService } from '../src/etat-des-lieux/edl-retention.service';
import { MailService } from '../src/mail/mail.service';
import {
  EdlPdfService,
  cheminNavigateur,
} from '../src/etat-des-lieux/edl-pdf.service';

/** Le jeton est le dernier segment du lien (`http://front.test/edl/<jeton>`). */
const jetonDuLien = (lien: string): string => lien.split('/edl/')[1];

describe('État des lieux — parcours API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let oneDrive: OneDriveFaux;
  let courrier: CourrierFaux;
  let cookieBailleur: string;
  let locataireId: number;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await recreerBaseE2e();

    oneDrive = new OneDriveFaux();
    courrier = new CourrierFaux();
    const constructeur = Test.createTestingModule({
      imports: [AppModule],
    })
      // Jamais de vrai appel à Microsoft ni de vrai e-mail dans les tests.
      .overrideProvider(OneDriveService)
      .useValue(oneDrive)
      .overrideProvider(MailService)
      .useValue(courrier)
      .setLogger(capteur);

    // Le PDF est fabriqué par un VRAI Chromium quand il y en a un sur la machine ;
    // sinon on le remplace par un faux (et le test le signale).
    if (!cheminNavigateur()) {
      console.warn('Aucun Chromium : le PDF est simulé dans ce test e2e.');
      constructeur.overrideProvider(EdlPdfService).useValue({
        generer: async () => Buffer.from('%PDF-1.4 faux'),
        nomFichier: () => 'etat-des-lieux-faux.pdf',
      });
    }
    const module = await constructeur.compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication);
    await app.init();

    dataSource = app.get(DataSource);

    // Session du bailleur : un access token signé comme le fait l'API, posé en
    // cookie (c'est ainsi que JwtStrategy le lit).
    const accessToken = await new JwtService({}).signAsync(
      { sub: 'owner' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 600 },
    );
    cookieBailleur = `access_token=${accessToken}`;

    const [appartement] = await dataSource.query<{ id: string }[]>(
      `SELECT "id" FROM "appartement" ORDER BY "id" LIMIT 1`,
    );
    const locataire = await dataSource.getRepository(Locataire).save({
      nom: 'Testeur',
      prenom: 'Léa',
      appartement: { id: Number(appartement.id) },
    });
    locataireId = locataire.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('refuse la création sans session du bailleur', async () => {
    await http()
      .post('/etats-des-lieux')
      .send({ locataireId, type: 'entree' })
      .expect(401);
  });

  describe('entrée : création, saisie, conflit, révocation', () => {
    let lien: string;
    let token: string;
    let edlId: string;
    let murs: { id: string };
    let sols: { id: string };

    it('crée le document et renvoie un lien à jeton signé', async () => {
      const reponse = await http()
        .post('/etats-des-lieux')
        .set('Cookie', cookieBailleur)
        .send({ locataireId, type: 'entree' })
        .expect(201);

      edlId = reponse.body.id;
      lien = reponse.body.lien;
      token = jetonDuLien(lien);

      expect(lien).toMatch(/^http:\/\/front\.test\/edl\/.+\..+\..+$/);
      expect(lien).not.toContain(edlId);
    });

    it('rejette un jeton falsifié et un simple identifiant', async () => {
      await http().get(`/etats-des-lieux/${edlId}`).expect(401);
      await http().get(`/etats-des-lieux/${token}x`).expect(401);
    });

    it('sert le document au locataire, sans session', async () => {
      const reponse = await http().get(`/etats-des-lieux/${token}`).expect(200);

      expect(reponse.body).toMatchObject({
        id: edlId,
        type: 'entree',
        statut: 'draft',
        referenceDisponible: false,
        locataire: { prenom: 'Léa', nom: 'Testeur' },
      });
      const elements = reponse.body.pieces[0].elements;
      expect(elements.map((e: { nom: string }) => e.nom)).toEqual([
        'Murs',
        'Sols',
        'Plafond',
        'Fenêtres',
        'Électricité',
        'Bureau',
      ]);
      [murs, sols] = elements;
      // Pas de signature ni de secret dans la réponse.
      expect(JSON.stringify(reponse.body)).not.toContain('signature');
    });

    it('refuse de valider une entrée sans état choisi', async () => {
      await http()
        .patch(`/etats-des-lieux/${token}/elements/${murs.id}`)
        .send({
          statutValidation: 'valide',
          modifieLe: new Date().toISOString(),
        })
        .expect(422);
    });

    it('enregistre une saisie, de façon idempotente', async () => {
      const corps = {
        etatLocataire: 'BON',
        commentaireLocataire: 'RAS',
        statutValidation: 'valide',
        modifieLe: '2026-10-15T10:00:00.000Z',
      };

      const premiere = await http()
        .patch(`/etats-des-lieux/${token}/elements/${murs.id}`)
        .send(corps)
        .expect(200);
      const rejeu = await http()
        .patch(`/etats-des-lieux/${token}/elements/${murs.id}`)
        .send(corps)
        .expect(200);

      expect(premiere.body).toMatchObject({
        etatLocataire: 'BON',
        commentaireLocataire: 'RAS',
        statutValidation: 'valide',
        dateModifLocataire: '2026-10-15T10:00:00.000Z',
      });
      expect(rejeu.body.updatedAt).toBe(premiere.body.updatedAt);

      // Une seule ligne d'historique malgré les deux appels.
      const historique = await dataSource.query<unknown[]>(
        `SELECT 1 FROM "edl_element_historique" WHERE "element_id" = $1`,
        [murs.id],
      );
      expect(historique).toHaveLength(1);
    });

    it('refuse une saisie plus ancienne que celle du serveur et renvoie la version du serveur', async () => {
      const reponse = await http()
        .patch(`/etats-des-lieux/${token}/elements/${murs.id}`)
        .send({
          etatLocataire: 'MAUVAIS',
          modifieLe: '2026-10-15T09:00:00.000Z',
        })
        .expect(409);

      expect(reponse.body).toMatchObject({
        code: 'VERSION_PLUS_RECENTE',
        element: { id: murs.id, etatLocataire: 'BON' },
      });
    });

    it('valide les entrées : état inconnu, champ superflu, identifiant non UUID', async () => {
      const url = `/etats-des-lieux/${token}/elements/${sols.id}`;
      const modifieLe = new Date().toISOString();

      await http()
        .patch(url)
        .send({ etatLocataire: 'PARFAIT', modifieLe })
        .expect(400);
      await http()
        .patch(url)
        .send({ etatLocataire: 'BON', modifieLe, admin: true })
        .expect(400);
      await http().patch(url).send({ etatLocataire: 'BON' }).expect(400);
      await http()
        .patch(`/etats-des-lieux/${token}/elements/pas-un-uuid`)
        .send({ etatLocataire: 'BON', modifieLe })
        .expect(400);
    });

    it('interdit de toucher un élément d’un autre document avec son propre jeton', async () => {
      const autre = await http()
        .post('/etats-des-lieux')
        .set('Cookie', cookieBailleur)
        .send({ locataireId, type: 'entree' })
        .expect(201);
      const detailAutre = await http()
        .get(`/etats-des-lieux/${jetonDuLien(autre.body.lien)}`)
        .expect(200);
      const elementEtranger = detailAutre.body.pieces[0].elements[0].id;

      await http()
        .patch(`/etats-des-lieux/${token}/elements/${elementEtranger}`)
        .send({ etatLocataire: 'BON', modifieLe: new Date().toISOString() })
        .expect(404);
    });

    it('révoque l’ancien lien quand le bailleur en génère un nouveau', async () => {
      const nouveau = await http()
        .post(`/etats-des-lieux/${edlId}/lien`)
        .set('Cookie', cookieBailleur)
        .expect(201);

      await http().get(`/etats-des-lieux/${token}`).expect(401);
      await http()
        .get(`/etats-des-lieux/${jetonDuLien(nouveau.body.lien)}`)
        .expect(200);
    });

    it('liste les documents du locataire avec leur avancement', async () => {
      const reponse = await http()
        .get(`/etats-des-lieux?locataireId=${locataireId}`)
        .set('Cookie', cookieBailleur)
        .expect(200);

      const ligne = reponse.body.find((l: { id: string }) => l.id === edlId);
      expect(ligne).toMatchObject({ elementsValides: 1, elementsTotal: 6 });
    });
  });

  describe('sortie : référence reprise de l’entrée signée', () => {
    it('sans entrée signée, la sortie n’a pas de référence', async () => {
      const sortie = await http()
        .post('/etats-des-lieux')
        .set('Cookie', cookieBailleur)
        .send({ locataireId, type: 'sortie' })
        .expect(201);
      const detail = await http()
        .get(`/etats-des-lieux/${jetonDuLien(sortie.body.lien)}`)
        .expect(200);

      expect(detail.body.referenceDisponible).toBe(false);
    });

    it('avec une entrée signée, chaque élément reprend la valeur retenue', async () => {
      const entree = await http()
        .post('/etats-des-lieux')
        .set('Cookie', cookieBailleur)
        .send({
          locataireId,
          type: 'entree',
          pieces: [
            {
              nom: 'Chambre 4',
              elements: [
                {
                  nom: 'Murs',
                  etatBailleur: 'BON',
                  commentaireBailleur: 'Propre',
                },
                { nom: 'Sols', etatBailleur: 'BON' },
              ],
            },
          ],
        })
        .expect(201);

      // La signature arrive en phase 5 : on pose ici le statut directement, et
      // une correction du locataire sur « Sols » (sa saisie prime sur celle du bailleur).
      await dataSource.query(
        `UPDATE "etat_des_lieux" SET "statut" = 'signed', "date_signature" = NOW() WHERE "id" = $1`,
        [entree.body.id],
      );
      await dataSource.query(
        `UPDATE "edl_element" SET "etat_locataire" = 'MOYEN', "commentaire_locataire" = 'Rayure'
         WHERE "nom" = 'Sols' AND "piece_id" IN (SELECT "id" FROM "edl_piece" WHERE "etat_des_lieux_id" = $1)`,
        [entree.body.id],
      );

      const sortie = await http()
        .post('/etats-des-lieux')
        .set('Cookie', cookieBailleur)
        .send({ locataireId, type: 'sortie' })
        .expect(201);
      const detail = await http()
        .get(`/etats-des-lieux/${jetonDuLien(sortie.body.lien)}`)
        .expect(200);

      expect(detail.body.referenceDisponible).toBe(true);
      const [murs, sols] = detail.body.pieces[0].elements;
      expect(murs).toMatchObject({
        nom: 'Murs',
        etatBailleur: 'BON',
        commentaireBailleur: 'Propre',
        etatLocataire: null,
        statutValidation: 'a_verifier',
      });
      expect(sols).toMatchObject({
        etatBailleur: 'MOYEN',
        commentaireBailleur: 'Rayure',
      });

      // Validation rapide : l'état du bailleur est accepté tel quel.
      const sortieToken = jetonDuLien(sortie.body.lien);
      await http()
        .patch(`/etats-des-lieux/${sortieToken}/elements/${murs.id}`)
        .send({
          statutValidation: 'valide',
          modifieLe: new Date().toISOString(),
        })
        .expect(200);
    });
  });

  describe('document signé : verrouillé', () => {
    it('refuse toute écriture et toute régénération du lien', async () => {
      const cree = await http()
        .post('/etats-des-lieux')
        .set('Cookie', cookieBailleur)
        .send({ locataireId, type: 'entree' })
        .expect(201);
      const token = jetonDuLien(cree.body.lien);
      const detail = await http().get(`/etats-des-lieux/${token}`).expect(200);
      const elementId = detail.body.pieces[0].elements[0].id;

      await dataSource.query(
        `UPDATE "etat_des_lieux" SET "statut" = 'signed' WHERE "id" = $1`,
        [cree.body.id],
      );

      const refus = await http()
        .patch(`/etats-des-lieux/${token}/elements/${elementId}`)
        .send({ etatLocataire: 'BON', modifieLe: new Date().toISOString() })
        .expect(409);
      expect(refus.body.code).toBe('DEJA_SIGNE');

      // La lecture reste permise.
      await http().get(`/etats-des-lieux/${token}`).expect(200);

      await http()
        .post(`/etats-des-lieux/${cree.body.id}/lien`)
        .set('Cookie', cookieBailleur)
        .expect(409);
    });
  });

  describe('photos', () => {
    // Les premiers octets suffisent : le serveur reconnaît l'image par sa signature.
    const jpeg = (marque = 'a') =>
      Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.from(marque.repeat(200)),
      ]);

    let token: string;
    let edlId: string;
    let elementId: string;

    beforeAll(async () => {
      const cree = await http()
        .post('/etats-des-lieux')
        .set('Cookie', cookieBailleur)
        .send({ locataireId, type: 'entree' })
        .expect(201);
      edlId = cree.body.id;
      token = jetonDuLien(cree.body.lien);
      const detail = await http().get(`/etats-des-lieux/${token}`).expect(200);
      elementId = detail.body.pieces[0].elements[0].id;
    });

    afterEach(() => {
      oneDrive.panne = null;
    });

    const envoyer = (
      id: string,
      fichier: Buffer,
      nom = 'photo.jpg',
      mime = 'image/jpeg',
    ) =>
      http()
        .post(`/etats-des-lieux/${token}/elements/${elementId}/photos`)
        .field('id', id)
        .attach('photo', fichier, { filename: nom, contentType: mime });

    const uuid = (n: number) =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

    it('range la photo dans l’arborescence OneDrive prévue et n’en garde que l’identifiant', async () => {
      const reponse = await envoyer(uuid(1), jpeg()).expect(201);

      expect(reponse.body).toMatchObject({ id: uuid(1), statutSync: 'synced' });
      const [fichier] = [...oneDrive.fichiers.values()];
      expect(fichier.chemin).toMatch(
        /^.+\/Testeur Léa\/entree\/Chambre\/Murs-\d{8}-\d{6}-00000000\.jpg$/,
      );
      expect(fichier.mime).toBe('image/jpeg');

      const [ligne] = await dataSource.query(
        `SELECT "onedrive_item_id", "onedrive_url", "statut_sync" FROM "edl_photo" WHERE "id" = $1`,
        [uuid(1)],
      );
      expect(ligne).toMatchObject({
        onedrive_item_id: 'ITEM-1',
        statut_sync: 'synced',
      });
    });

    it('est idempotente : rejouer le même envoi ne crée ni doublon ni second fichier', async () => {
      const avant = oneDrive.fichiers.size;

      await envoyer(uuid(1), jpeg()).expect(201);

      expect(oneDrive.fichiers.size).toBe(avant);
      const lignes = await dataSource.query(
        `SELECT 1 FROM "edl_photo" WHERE "id" = $1`,
        [uuid(1)],
      );
      expect(lignes).toHaveLength(1);
    });

    it('apparaît dans le document renvoyé au locataire', async () => {
      const detail = await http().get(`/etats-des-lieux/${token}`).expect(200);

      expect(detail.body.pieces[0].elements[0].photos).toEqual([
        expect.objectContaining({ id: uuid(1), statutSync: 'synced' }),
      ]);
    });

    it('sert l’image par l’API, sans jamais montrer Microsoft', async () => {
      const reponse = await http()
        .get(`/etats-des-lieux/${token}/photos/${uuid(1)}`)
        .buffer(true)
        .expect(200);

      expect(reponse.headers['content-type']).toContain('image/jpeg');
      expect(reponse.headers['cache-control']).toContain('private');
      expect(Buffer.from(reponse.body)).toEqual(jpeg());
      expect(JSON.stringify(reponse.headers)).not.toContain('onedrive');
    });

    it('refuse un fichier qui n’est pas une image, même annoncé « image/jpeg »', async () => {
      const refus = await envoyer(
        uuid(2),
        Buffer.from('MZ programme'),
        'virus.jpg',
        'image/jpeg',
      ).expect(415);

      expect(refus.body.code).toBe('FICHIER_INVALIDE');
    });

    it('refuse un fichier trop gros avant de le traiter', async () => {
      await envoyer(
        uuid(3),
        Buffer.concat([jpeg(), Buffer.alloc(9 * 1024 * 1024)]),
      ).expect(413);
    });

    it('refuse une requête sans fichier ou sans identifiant valide', async () => {
      await http()
        .post(`/etats-des-lieux/${token}/elements/${elementId}/photos`)
        .field('id', uuid(4))
        .expect(422);
      await envoyer('pas-un-uuid', jpeg()).expect(400);
    });

    it('limite à 5 photos par élément', async () => {
      for (let n = 10; n < 14; n++) {
        await envoyer(uuid(n), jpeg(String(n))).expect(201);
      }
      const refus = await envoyer(uuid(20), jpeg('z')).expect(422);

      expect(refus.body.code).toBe('TROP_DE_PHOTOS');
      // Le fichier refusé n'est pas resté chez Microsoft.
      expect(oneDrive.fichiers.size).toBe(5);
    });

    it('répond 503 + Retry-After quand OneDrive limite (429), sans rien enregistrer', async () => {
      // Un autre élément, pour ne pas buter sur la limite de 5.
      const detail = await http().get(`/etats-des-lieux/${token}`).expect(200);
      const autre = detail.body.pieces[0].elements[1].id;
      oneDrive.panne = new OneDriveIndisponibleError(
        'LIMITE',
        'trop de requêtes',
        30,
      );

      const reponse = await http()
        .post(`/etats-des-lieux/${token}/elements/${autre}/photos`)
        .field('id', uuid(30))
        .attach('photo', jpeg('q'), {
          filename: 'p.jpg',
          contentType: 'image/jpeg',
        })
        .expect(503);

      expect(reponse.headers['retry-after']).toBe('30');
      expect(reponse.body.code).toBe('ONEDRIVE_LIMITE');
      const lignes = await dataSource.query(
        `SELECT 1 FROM "edl_photo" WHERE "id" = $1`,
        [uuid(30)],
      );
      expect(lignes).toHaveLength(0);

      // OneDrive revient : le même envoi, rejoué, passe.
      oneDrive.panne = null;
      await http()
        .post(`/etats-des-lieux/${token}/elements/${autre}/photos`)
        .field('id', uuid(30))
        .attach('photo', jpeg('q'), {
          filename: 'p.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);
    });

    it('signale OneDrive non connecté ou révoqué par un 503 nommé', async () => {
      const detail = await http().get(`/etats-des-lieux/${token}`).expect(200);
      const autre = detail.body.pieces[0].elements[2].id;
      oneDrive.panne = new OneDriveIndisponibleError('REVOQUE', 'révoqué');

      const reponse = await http()
        .post(`/etats-des-lieux/${token}/elements/${autre}/photos`)
        .field('id', uuid(31))
        .attach('photo', jpeg(), {
          filename: 'p.jpg',
          contentType: 'image/jpeg',
        })
        .expect(503);

      expect(reponse.body.code).toBe('ONEDRIVE_REVOQUE');
    });

    it('refuse un élément d’un autre document', async () => {
      const autre = await http()
        .post('/etats-des-lieux')
        .set('Cookie', cookieBailleur)
        .send({ locataireId, type: 'entree' })
        .expect(201);
      const detailAutre = await http()
        .get(`/etats-des-lieux/${jetonDuLien(autre.body.lien)}`)
        .expect(200);

      await http()
        .post(
          `/etats-des-lieux/${token}/elements/${detailAutre.body.pieces[0].elements[0].id}/photos`,
        )
        .field('id', uuid(40))
        .attach('photo', jpeg(), {
          filename: 'p.jpg',
          contentType: 'image/jpeg',
        })
        .expect(404);
    });

    it('supprime une photo (fichier OneDrive compris), et de façon idempotente', async () => {
      const avant = oneDrive.fichiers.size;

      await http()
        .delete(`/etats-des-lieux/${token}/photos/${uuid(1)}`)
        .expect(204);
      await http()
        .delete(`/etats-des-lieux/${token}/photos/${uuid(1)}`)
        .expect(204);

      expect(oneDrive.fichiers.size).toBe(avant - 1);
      const lignes = await dataSource.query(
        `SELECT 1 FROM "edl_photo" WHERE "id" = $1`,
        [uuid(1)],
      );
      expect(lignes).toHaveLength(0);
    });

    it('garde la photo en base quand OneDrive refuse la suppression (elle sera rejouée)', async () => {
      oneDrive.panne = new OneDriveIndisponibleError('INDISPONIBLE', 'panne');

      await http()
        .delete(`/etats-des-lieux/${token}/photos/${uuid(10)}`)
        .expect(503);

      const lignes = await dataSource.query(
        `SELECT 1 FROM "edl_photo" WHERE "id" = $1`,
        [uuid(10)],
      );
      expect(lignes).toHaveLength(1);
    });

    it('verrouille les photos une fois le document signé', async () => {
      await dataSource.query(
        `UPDATE "etat_des_lieux" SET "statut" = 'signed' WHERE "id" = $1`,
        [edlId],
      );

      await envoyer(uuid(50), jpeg()).expect(409);
      await http()
        .delete(`/etats-des-lieux/${token}/photos/${uuid(10)}`)
        .expect(409);
      // La lecture reste permise.
      await http()
        .get(`/etats-des-lieux/${token}/photos/${uuid(10)}`)
        .expect(200);
    });
  });

  describe('validation, signature, PDF et e-mails', () => {
    const uuid = (n: number) =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const jpeg = () =>
      Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.from('photo'.repeat(100)),
      ]);
    // PNG minimal (en-tête valide) : le serveur reconnaît la signature par ses premiers octets.
    const png = (taille = 40) =>
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(taille, 1),
      ]).toString('base64');

    /** Crée un document à 2 éléments et renvoie ses repères. */
    async function nouveauDocument(type: 'entree' | 'sortie' = 'entree') {
      const cree = await http()
        .post('/etats-des-lieux')
        .set('Cookie', cookieBailleur)
        .send({
          locataireId,
          type,
          pieces: [
            { nom: 'Chambre 4', elements: [{ nom: 'Murs' }, { nom: 'Sols' }] },
          ],
        })
        .expect(201);
      const token = jetonDuLien(cree.body.lien);
      const detail = await http().get(`/etats-des-lieux/${token}`).expect(200);
      const [murs, sols] = detail.body.pieces[0].elements as { id: string }[];
      return {
        id: cree.body.id as string,
        token,
        murs: murs.id,
        sols: sols.id,
      };
    }

    const traiter = (token: string, elementId: string, corps: object = {}) =>
      http()
        .patch(`/etats-des-lieux/${token}/elements/${elementId}`)
        .send({
          etatLocataire: 'BON',
          statutValidation: 'valide',
          modifieLe: new Date().toISOString(),
          ...corps,
        });

    beforeAll(async () => {
      await dataSource.query(
        `UPDATE "locataire" SET "email" = 'lea@test.fr' WHERE "id" = $1`,
        [locataireId],
      );
    });

    beforeEach(() => {
      courrier.messages.length = 0;
      courrier.echecPour = null;
      // Tous les appels des tests viennent de la même IP : on remet les
      // compteurs de limitation à zéro entre deux tests (sauf celui qui les teste).
      const limitation = app.get(ThrottlerStorage) as unknown as {
        storage: Map<string, unknown>;
        hitExpirations: Map<string, unknown>;
      };
      limitation.storage.clear();
      limitation.hitExpirations.clear();
    });

    describe('validation globale', () => {
      it('liste ce qui manque tant que tout n’est pas traité (422)', async () => {
        const doc = await nouveauDocument();
        await traiter(doc.token, doc.murs).expect(200);

        const refus = await http()
          .post(`/etats-des-lieux/${doc.token}/validate`)
          .expect(422);

        expect(refus.body).toMatchObject({
          code: 'ELEMENTS_MANQUANTS',
          manquants: [
            { pieceNom: 'Chambre 4', elementId: doc.sols, elementNom: 'Sols' },
          ],
        });
        const [{ statut }] = await dataSource.query(
          `SELECT "statut" FROM "etat_des_lieux" WHERE "id" = $1`,
          [doc.id],
        );
        expect(statut).toBe('draft');
      });

      it('passe à « validated », idempotent, et verrouille les éléments', async () => {
        const doc = await nouveauDocument();
        await traiter(doc.token, doc.murs).expect(200);
        await traiter(doc.token, doc.sols).expect(200);

        await http()
          .post(`/etats-des-lieux/${doc.token}/validate`)
          .expect(200, { statut: 'validated' });
        await http()
          .post(`/etats-des-lieux/${doc.token}/validate`)
          .expect(200, { statut: 'validated' });

        const refus = await traiter(doc.token, doc.murs, {
          etatLocataire: 'MAUVAIS',
        }).expect(409);
        expect(refus.body.code).toBe('NON_MODIFIABLE');
      });

      it('le bailleur peut rouvrir un document validé, pas un brouillon ni un signé', async () => {
        const doc = await nouveauDocument();
        await http()
          .post(`/etats-des-lieux/${doc.id}/reouvrir`)
          .set('Cookie', cookieBailleur)
          .expect(409);

        await traiter(doc.token, doc.murs).expect(200);
        await traiter(doc.token, doc.sols).expect(200);
        await http().post(`/etats-des-lieux/${doc.token}/validate`).expect(200);

        await http()
          .post(`/etats-des-lieux/${doc.id}/reouvrir`)
          .set('Cookie', cookieBailleur)
          .expect(200, { statut: 'draft' });
        await traiter(doc.token, doc.murs, { etatLocataire: 'NEUF' }).expect(
          200,
        );
      });
    });

    describe('signature', () => {
      it('refuse de signer tant que tout n’est pas traité, sans rien verrouiller', async () => {
        const doc = await nouveauDocument();
        await traiter(doc.token, doc.murs).expect(200);

        const refus = await http()
          .post(`/etats-des-lieux/${doc.token}/sign`)
          .send({ signatureLocataire: png() })
          .expect(422);

        expect(refus.body.code).toBe('ELEMENTS_MANQUANTS');
        await traiter(doc.token, doc.sols).expect(200);
      });

      it('refuse une signature qui n’est pas un PNG, trop lourde, ou absente — sans rien verrouiller', async () => {
        const doc = await nouveauDocument();
        await traiter(doc.token, doc.murs).expect(200);
        await traiter(doc.token, doc.sols).expect(200);
        const sign = (corps: object) =>
          http().post(`/etats-des-lieux/${doc.token}/sign`).send(corps);

        await sign({}).expect(400);
        await sign({
          signatureLocataire:
            Buffer.from('<script>x</script>').toString('base64'),
        }).expect(422);
        await sign({ signatureLocataire: png(210 * 1024) }).expect(422);
        await sign({
          signatureLocataire: png(),
          signatureBailleur: 'pas du base64 !',
        }).expect(422);

        const [{ statut }] = await dataSource.query(
          `SELECT "statut" FROM "etat_des_lieux" WHERE "id" = $1`,
          [doc.id],
        );
        expect(statut).not.toBe('signed');
      });

      it('parcours complet : saisie, photo, validation, signature, PDF, e-mails, archive, verrouillage', async () => {
        const doc = await nouveauDocument();
        await traiter(doc.token, doc.murs).expect(200);
        await traiter(doc.token, doc.sols, {
          etatLocataire: 'MOYEN',
          commentaireLocataire: 'Rayure près du <bureau> & du lit',
        }).expect(200);
        await http()
          .post(`/etats-des-lieux/${doc.token}/elements/${doc.sols}/photos`)
          .field('id', uuid(900))
          .attach('photo', jpeg(), {
            filename: 'p.jpg',
            contentType: 'image/jpeg',
          })
          .expect(201);
        await http().post(`/etats-des-lieux/${doc.token}/validate`).expect(200);

        const signature = await http()
          .post(`/etats-des-lieux/${doc.token}/sign`)
          .send({
            signatureLocataire: `data:image/png;base64,${png()}`,
            signatureBailleur: png(),
          })
          .expect(200);

        // 1. Signé, et tout ce qui suit a marché.
        expect(signature.body).toMatchObject({
          statut: 'signed',
          pdf: true,
          emailLocataire: true,
          emailBailleur: true,
          archive: true,
        });

        // 2. Deux e-mails, PDF en pièce jointe, sans le lien secret.
        expect(courrier.messages.map((m) => m.to).sort()).toEqual(
          expect.arrayContaining(['lea@test.fr']),
        );
        expect(courrier.messages).toHaveLength(2);
        for (const message of courrier.messages) {
          const [pdf] = message.attachments ?? [];
          expect(pdf.filename).toMatch(
            /^etat-des-lieux-entree-\d{4}-\d{2}-\d{2}\.pdf$/,
          );
          expect(pdf.content.subarray(0, 4).toString()).toBe('%PDF');
          expect(pdf.content.length).toBeGreaterThan(2_000);
          expect(message.text).not.toContain(doc.token);
        }
        expect(
          courrier.messages.find((m) => m.to === 'lea@test.fr')?.subject,
        ).toContain('signé');

        // 3. Archive du PDF dans le dossier OneDrive du dossier, à côté des photos.
        const chemins = [...oneDrive.fichiers.values()].map((f) => f.chemin);
        const archive = chemins.find((c) => c.endsWith('.pdf'));
        expect(archive).toMatch(
          /\/Testeur Léa\/entree\/etat-des-lieux-entree-\d{4}-\d{2}-\d{2}\.pdf$/,
        );
        expect(
          chemins.some((c) =>
            c.includes('/Testeur Léa/entree/Chambre 4/Sols-'),
          ),
        ).toBe(true);

        // 4. En base : signatures, date, empreinte, envoi.
        const [ligne] = await dataSource.query(
          `SELECT "statut", "date_signature", "signature_locataire", "signature_bailleur",
                  "empreinte", "pdf_envoye_le", "pdf_onedrive_item_id"
             FROM "etat_des_lieux" WHERE "id" = $1`,
          [doc.id],
        );
        expect(ligne.statut).toBe('signed');
        expect(ligne.date_signature).not.toBeNull();
        expect(ligne.signature_locataire).toBe(png());
        expect(ligne.signature_bailleur).toBe(png());
        expect(ligne.empreinte).toMatch(/^[0-9a-f]{64}$/);
        expect(ligne.pdf_envoye_le).not.toBeNull();
        expect(ligne.pdf_onedrive_item_id).not.toBeNull();

        // 5. Tout est verrouillé, de toutes les façons.
        const verrou = (r: request.Test) => r.expect(409);
        const refus = await verrou(
          traiter(doc.token, doc.murs, { etatLocataire: 'NEUF' }),
        );
        expect(refus.body.code).toBe('DEJA_SIGNE');
        await verrou(http().post(`/etats-des-lieux/${doc.token}/validate`));
        await verrou(
          http()
            .post(`/etats-des-lieux/${doc.token}/sign`)
            .send({ signatureLocataire: png() }),
        );
        await verrou(
          http()
            .post(`/etats-des-lieux/${doc.token}/elements/${doc.sols}/photos`)
            .field('id', uuid(901))
            .attach('photo', jpeg(), {
              filename: 'p.jpg',
              contentType: 'image/jpeg',
            }),
        );
        await verrou(
          http().delete(`/etats-des-lieux/${doc.token}/photos/${uuid(900)}`),
        );
        await verrou(
          http()
            .post(`/etats-des-lieux/${doc.id}/lien`)
            .set('Cookie', cookieBailleur),
        );

        // 6. Le document signé reste lisible, sans jamais exposer les signatures.
        const lu = await http()
          .get(`/etats-des-lieux/${doc.token}`)
          .expect(200);
        expect(lu.body.statut).toBe('signed');
        expect(JSON.stringify(lu.body)).not.toContain(png());
      });

      it('le PDF contient le constat, la signature et l’empreinte, et l’échappement tient', async () => {
        const doc = await nouveauDocument();
        await traiter(doc.token, doc.murs).expect(200);
        await traiter(doc.token, doc.sols, {
          commentaireLocataire: '<script>document.title="piraté"</script>',
        }).expect(200);
        await http()
          .post(`/etats-des-lieux/${doc.token}/sign`)
          .send({ signatureLocataire: png() })
          .expect(200);

        const reponse = await http()
          .get(`/etats-des-lieux/${doc.id}/pdf`)
          .set('Cookie', cookieBailleur)
          .buffer(true)
          .expect(200);

        expect(reponse.headers['content-type']).toContain('application/pdf');
        expect(reponse.headers['content-disposition']).toMatch(
          /attachment; filename="etat-des-lieux-entree-/,
        );
        expect(Buffer.from(reponse.body).subarray(0, 4).toString()).toBe(
          '%PDF',
        );
      });

      it('la signature reste acquise quand le PDF échoue, et « renvoyer » rattrape', async () => {
        const doc = await nouveauDocument();
        await traiter(doc.token, doc.murs).expect(200);
        await traiter(doc.token, doc.sols).expect(200);
        const pdf = app.get(EdlPdfService);
        const espion = jest
          .spyOn(pdf, 'generer')
          .mockRejectedValueOnce(new Error('Chromium a planté'));

        const signature = await http()
          .post(`/etats-des-lieux/${doc.token}/sign`)
          .send({ signatureLocataire: png() })
          .expect(200);

        expect(signature.body).toMatchObject({
          statut: 'signed',
          pdf: false,
          emailLocataire: false,
          emailBailleur: false,
        });
        expect(courrier.messages).toHaveLength(0);
        espion.mockRestore();

        const rattrape = await http()
          .post(`/etats-des-lieux/${doc.id}/renvoyer`)
          .set('Cookie', cookieBailleur)
          .expect(200);

        expect(rattrape.body).toMatchObject({
          pdf: true,
          emailLocataire: true,
          emailBailleur: true,
        });
        expect(courrier.messages).toHaveLength(2);
      });

      it('l’échec d’un e-mail n’empêche pas l’autre destinataire de recevoir le sien', async () => {
        const doc = await nouveauDocument();
        await traiter(doc.token, doc.murs).expect(200);
        await traiter(doc.token, doc.sols).expect(200);
        courrier.echecPour = 'lea@test.fr';

        const signature = await http()
          .post(`/etats-des-lieux/${doc.token}/sign`)
          .send({ signatureLocataire: png() })
          .expect(200);

        expect(signature.body).toMatchObject({
          statut: 'signed',
          emailLocataire: false,
          emailBailleur: true,
        });
        expect(courrier.messages).toHaveLength(1);
        expect(courrier.messages[0].to).not.toBe('lea@test.fr');
      });

      it('limite les tentatives de signature (anti-martelage) : 429 à la 6e en une minute', async () => {
        const doc = await nouveauDocument();
        const tenter = () =>
          http()
            .post(`/etats-des-lieux/${doc.token}/sign`)
            .send({ signatureLocataire: png() });

        // Éléments non traités : chaque essai est refusé (422), mais compté.
        for (let essai = 1; essai <= 5; essai++) {
          await tenter().expect(422);
        }
        await tenter().expect(429);
      });

      it('« renvoyer » exige un document signé et une session', async () => {
        const doc = await nouveauDocument();

        await http().post(`/etats-des-lieux/${doc.id}/renvoyer`).expect(401);
        await http()
          .post(`/etats-des-lieux/${doc.id}/renvoyer`)
          .set('Cookie', cookieBailleur)
          .expect(409);
        await http().get(`/etats-des-lieux/${doc.id}/pdf`).expect(401);
      });
    });

    describe('envoi du lien par e-mail', () => {
      it('écrit au locataire, sans copie cachée (le lien est un secret)', async () => {
        const doc = await nouveauDocument();

        await http()
          .post(`/etats-des-lieux/${doc.id}/envoyer-lien`)
          .set('Cookie', cookieBailleur)
          .expect(200, { envoyeA: 'lea@test.fr' });

        const [message] = courrier.messages;
        expect(message.to).toBe('lea@test.fr');
        expect(message.sansCopie).toBe(true);
        expect(message.subject).toContain('État des lieux');

        // Le lien envoyé est re-signé (même version de lien, horodatage différent) :
        // ce qui compte est qu'il OUVRE le document.
        const lienEnvoye = /http:\/\/front\.test\/edl\/\S+/.exec(
          message.text,
        )?.[0];
        expect(lienEnvoye).toBeDefined();
        const lu = await http()
          .get(`/etats-des-lieux/${jetonDuLien(lienEnvoye!)}`)
          .expect(200);
        expect(lu.body.id).toBe(doc.id);
      });

      it('refuse sans adresse e-mail du locataire', async () => {
        const doc = await nouveauDocument();
        await dataSource.query(
          `UPDATE "locataire" SET "email" = NULL WHERE "id" = $1`,
          [locataireId],
        );

        await http()
          .post(`/etats-des-lieux/${doc.id}/envoyer-lien`)
          .set('Cookie', cookieBailleur)
          .expect(422);

        await dataSource.query(
          `UPDATE "locataire" SET "email" = 'lea@test.fr' WHERE "id" = $1`,
          [locataireId],
        );
        expect(courrier.messages).toHaveLength(0);
      });
    });
  });

  describe('RGPD : conservation, export, effacement', () => {
    const uuid = (n: number) =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const jpeg = () =>
      Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.from('photo'.repeat(100)),
      ]);
    const png = () =>
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(40, 1),
      ]).toString('base64');
    const cheminsOneDrive = () =>
      [...oneDrive.fichiers.values()].map((f) => f.chemin);

    let appartementId: number;

    beforeAll(async () => {
      const [{ id }] = await dataSource.query(
        `SELECT "id" FROM "appartement" ORDER BY "id" LIMIT 1`,
      );
      appartementId = Number(id);
    });

    beforeEach(() => {
      oneDrive.panne = null;
      const limitation = app.get(ThrottlerStorage) as unknown as {
        storage: Map<string, unknown>;
        hitExpirations: Map<string, unknown>;
      };
      limitation.storage.clear();
      limitation.hitExpirations.clear();
    });

    /** Un locataire, sorti il y a `anneesDepuisSortie` ans (ou en place), avec un état des lieux SIGNÉ, une photo et un PDF archivé. */
    async function locataireAvecDocument(
      nom: string,
      anneesDepuisSortie: number | null,
      numeroPhoto: number,
    ) {
      const sortie =
        anneesDepuisSortie === null
          ? null
          : new Date(
              Date.now() - anneesDepuisSortie * 365.25 * 24 * 3600 * 1000,
            )
              .toISOString()
              .slice(0, 10);
      const locataire = await dataSource.getRepository(Locataire).save({
        nom,
        prenom: 'Test',
        appartement: { id: appartementId },
        sortie,
      });

      const cree = await http()
        .post('/etats-des-lieux')
        .set('Cookie', cookieBailleur)
        .send({
          locataireId: locataire.id,
          type: 'entree',
          pieces: [{ nom: 'Chambre', elements: [{ nom: 'Murs' }] }],
        })
        .expect(201);
      const token = jetonDuLien(cree.body.lien);
      const detail = await http().get(`/etats-des-lieux/${token}`).expect(200);
      const elementId = detail.body.pieces[0].elements[0].id;

      await http()
        .patch(`/etats-des-lieux/${token}/elements/${elementId}`)
        .send({
          etatLocataire: 'BON',
          commentaireLocataire: `Commentaire de ${nom}`,
          statutValidation: 'valide',
          modifieLe: new Date().toISOString(),
        })
        .expect(200);
      await http()
        .post(`/etats-des-lieux/${token}/elements/${elementId}/photos`)
        .field('id', uuid(numeroPhoto))
        .attach('photo', jpeg(), {
          filename: 'p.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);
      const pdf = await oneDrive.televerser(
        `archive/${nom}.pdf`,
        Buffer.from('%PDF'),
        'application/pdf',
      );
      await dataSource.query(
        `UPDATE "etat_des_lieux"
            SET "statut" = 'signed', "date_signature" = NOW(),
                "signature_locataire" = $2, "pdf_onedrive_item_id" = $3
          WHERE "id" = $1`,
        [cree.body.id, png(), pdf.itemId],
      );

      return { locataire, edlId: cree.body.id as string, token };
    }

    const nbDocuments = async (locataireId: number): Promise<number> =>
      (
        await dataSource.query(
          `SELECT 1 FROM "etat_des_lieux" WHERE "locataire_id" = $1`,
          [locataireId],
        )
      ).length;

    describe('purge des documents échus (sortie + 3 ans)', () => {
      it('ne touche qu’aux locataires sortis depuis plus de 3 ans', async () => {
        const ancien = await locataireAvecDocument('Ancien', 4, 3001);
        const recent = await locataireAvecDocument('Recent', 1, 3002);
        const enPlace = await locataireAvecDocument('EnPlace', null, 3003);
        const fichiersAvant = oneDrive.fichiers.size;

        const simulation = await http()
          .post('/rgpd/etats-des-lieux/retention/purger?simulation=true')
          .set('Cookie', cookieBailleur)
          .expect(200);
        expect(simulation.body).toMatchObject({
          simulation: true,
          documentsEchus: 1,
          documentsSupprimes: 0,
        });
        expect(await nbDocuments(ancien.locataire.id)).toBe(1);

        const purge = await http()
          .post('/rgpd/etats-des-lieux/retention/purger')
          .set('Cookie', cookieBailleur)
          .expect(200);

        expect(purge.body).toMatchObject({
          simulation: false,
          documentsEchus: 1,
          documentsSupprimes: 1,
          fichiersSupprimes: 2, // la photo ET le PDF archivé
          echecs: 0,
        });
        expect(await nbDocuments(ancien.locataire.id)).toBe(0);
        expect(await nbDocuments(recent.locataire.id)).toBe(1);
        expect(await nbDocuments(enPlace.locataire.id)).toBe(1);
        expect(oneDrive.fichiers.size).toBe(fichiersAvant - 2);
        expect(cheminsOneDrive().some((c) => c.includes('Ancien'))).toBe(false);
        // Les photos et l'historique partent avec le document.
        const orphelines = await dataSource.query(
          `SELECT 1 FROM "edl_photo" WHERE "id" = $1`,
          [uuid(3001)],
        );
        expect(orphelines).toHaveLength(0);
        // La fiche du locataire, elle, n'est pas du ressort de ce module.
        const [fiche] = await dataSource.query(
          `SELECT 1 FROM "locataire" WHERE "id" = $1`,
          [ancien.locataire.id],
        );
        expect(fiche).toBeDefined();
      });

      it('garde le document (et ses identifiants de fichiers) quand OneDrive refuse de supprimer', async () => {
        const ancien = await locataireAvecDocument('AncienBloque', 5, 3010);
        oneDrive.panne = new OneDriveIndisponibleError('REVOQUE', 'révoqué');

        const purge = await http()
          .post('/rgpd/etats-des-lieux/retention/purger')
          .set('Cookie', cookieBailleur)
          .expect(200);

        expect(purge.body).toMatchObject({ documentsSupprimes: 0, echecs: 1 });
        expect(await nbDocuments(ancien.locataire.id)).toBe(1);

        // OneDrive revient : le passage suivant termine le travail.
        oneDrive.panne = null;
        const reprise = await http()
          .post('/rgpd/etats-des-lieux/retention/purger')
          .set('Cookie', cookieBailleur)
          .expect(200);
        expect(reprise.body).toMatchObject({
          documentsSupprimes: 1,
          echecs: 0,
        });
        expect(await nbDocuments(ancien.locataire.id)).toBe(0);
      });

      it('est réservée au bailleur connecté', async () => {
        await http().post('/rgpd/etats-des-lieux/retention/purger').expect(401);
      });

      it('programme une tâche quotidienne', () => {
        expect(
          app.get(SchedulerRegistry).getCronJobs().size,
        ).toBeGreaterThanOrEqual(1);
        expect(
          app
            .get(EdlRetentionService)
            .dateLimite(new Date('2026-10-15T12:00:00Z')),
        ).toBe('2023-10-15');
      });
    });

    describe('droits des personnes', () => {
      it('exporte tout ce qui concerne un locataire, signature et historique compris', async () => {
        const { locataire } = await locataireAvecDocument(
          'ExportMoi',
          null,
          3020,
        );

        const reponse = await http()
          .get(`/rgpd/etats-des-lieux/locataire/${locataire.id}/export`)
          .set('Cookie', cookieBailleur)
          .expect(200);

        expect(reponse.headers['content-disposition']).toContain('attachment');
        const [doc] = reponse.body.etatsDesLieux;
        expect(reponse.body.locataire).toMatchObject({
          id: locataire.id,
          nom: 'ExportMoi',
        });
        expect(doc.signatureLocataire).toBe(png());
        const [element] = doc.pieces[0].elements;
        expect(element.commentaireLocataire).toBe('Commentaire de ExportMoi');
        expect(element.photos).toHaveLength(1);
        expect(element.historique).toHaveLength(1);
        expect(element.historique[0]).toMatchObject({ auteur: 'locataire' });
      });

      it('efface tout (documents, photos, PDF OneDrive) sans toucher aux autres locataires', async () => {
        const cible = await locataireAvecDocument('EffaceMoi', null, 3030);
        const autre = await locataireAvecDocument('GardeMoi', null, 3031);
        const avant = oneDrive.fichiers.size;

        const reponse = await http()
          .delete(`/rgpd/etats-des-lieux/locataire/${cible.locataire.id}`)
          .set('Cookie', cookieBailleur)
          .expect(200);

        expect(reponse.body).toMatchObject({
          documentsSupprimes: 1,
          fichiersSupprimes: 2,
          echecs: 0,
        });
        expect(await nbDocuments(cible.locataire.id)).toBe(0);
        expect(await nbDocuments(autre.locataire.id)).toBe(1);
        expect(oneDrive.fichiers.size).toBe(avant - 2);
        // Le lien du locataire effacé ne mène plus à rien.
        await http().get(`/etats-des-lieux/${cible.token}`).expect(401);
      });

      it('exige une session et un locataire existant', async () => {
        await http()
          .get('/rgpd/etats-des-lieux/locataire/1/export')
          .expect(401);
        await http().delete('/rgpd/etats-des-lieux/locataire/1').expect(401);
        await http()
          .get('/rgpd/etats-des-lieux/locataire/999999/export')
          .set('Cookie', cookieBailleur)
          .expect(404);
      });
    });

    describe('durcissement', () => {
      it('interdit la mise en cache des réponses qui portent des données personnelles', async () => {
        const { token } = await locataireAvecDocument('SansCache', null, 3040);

        const doc = await http().get(`/etats-des-lieux/${token}`).expect(200);
        expect(doc.headers['cache-control']).toBe('no-store');
        // Mais les images, privées, peuvent rester en cache dans le navigateur du locataire.
        const image = await http()
          .get(`/etats-des-lieux/${token}/photos/${uuid(3040)}`)
          .expect(200);
        expect(image.headers['cache-control']).toBe('private, max-age=3600');
      });

      it('envoie les en-têtes de sécurité (helmet)', async () => {
        const reponse = await http().get('/etats-des-lieux/x').expect(401);

        expect(reponse.headers['x-content-type-options']).toBe('nosniff');
        expect(reponse.headers['x-powered-by']).toBeUndefined();
        expect(reponse.headers['strict-transport-security']).toBeDefined();
      });

      it('n’accepte les appels navigateur que de l’origine du front', async () => {
        const accepte = await http()
          .options('/etats-des-lieux/x/elements/y')
          .set('Origin', 'http://localhost:4200')
          .set('Access-Control-Request-Method', 'PATCH');
        expect(accepte.headers['access-control-allow-origin']).toBe(
          'http://localhost:4200',
        );
        expect(accepte.headers['access-control-allow-methods']).toContain(
          'PATCH',
        );

        const refuse = await http()
          .options('/etats-des-lieux/x/elements/y')
          .set('Origin', 'https://pirate.example')
          .set('Access-Control-Request-Method', 'PATCH');
        expect(refuse.headers['access-control-allow-origin']).not.toBe(
          'https://pirate.example',
        );
      });
    });
  });

  // DOIT rester le dernier test : il relit tout ce qui a été journalisé pendant la suite.
  describe('journalisation', () => {
    it('ne contient ni jeton, ni signature, ni commentaire, ni e-mail, ni secret', () => {
      const tout = journal.join('\n');

      // Le journal a bien été alimenté (sinon ce test ne prouverait rien).
      expect(journal.length).toBeGreaterThan(30);
      expect(tout).toContain('Création');

      const interdits: [string, RegExp | string][] = [
        ['un jeton JWT', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
        ['une signature (début de PNG en base64)', 'iVBORw0KGgo'],
        [
          'un commentaire de locataire',
          /Commentaire de |Rayure près du|piraté|Tache/,
        ],
        ['une adresse e-mail', /[\w.+-]+@[\w-]+\.[a-z]{2,}/i],
        ['le secret des liens', process.env.EDL_TOKEN_SECRET as string],
        ['le secret de session', process.env.JWT_ACCESS_SECRET as string],
      ];
      for (const [nom, motif] of interdits) {
        const trouve =
          typeof motif === 'string' ? tout.includes(motif) : motif.test(tout);
        expect([nom, trouve]).toEqual([nom, false]);
      }
    });
  });
});
