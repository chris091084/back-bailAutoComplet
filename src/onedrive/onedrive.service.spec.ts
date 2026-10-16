import { OneDriveAuthService } from './onedrive-auth.service';
import {
  OneDriveService,
  SEUIL_SESSION_OCTETS,
  TAILLE_MORCEAU,
} from './onedrive.service';

const json = (
  corps: object,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(corps), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('OneDriveService', () => {
  let auth: jest.Mocked<Pick<OneDriveAuthService, 'accessToken' | 'invalider'>>;
  let fetchMock: jest.SpyInstance;
  let service: OneDriveService;

  beforeEach(() => {
    auth = {
      accessToken: jest.fn().mockResolvedValue('JETON'),
      invalider: jest.fn(),
    };
    fetchMock = jest.spyOn(globalThis, 'fetch');
    service = new OneDriveService(auth as unknown as OneDriveAuthService);
  });

  afterEach(() => fetchMock.mockRestore());

  const appel = (n: number) => {
    const [url, init] = fetchMock.mock.calls[n];
    return {
      url: String(url),
      init: init as RequestInit & { headers: Record<string, string> },
    };
  };

  describe('téléversement', () => {
    it('envoie un petit fichier d’un seul PUT dans le dossier applicatif', async () => {
      fetchMock.mockResolvedValueOnce(
        json({ id: 'ITEM1', webUrl: 'https://1drv.ms/x' }, 201),
      );

      const resultat = await service.televerser(
        'Adresse 1/Léa T/entree/Chambre/Murs-1.jpg',
        Buffer.from('jpeg'),
        'image/jpeg',
      );

      expect(resultat).toEqual({
        itemId: 'ITEM1',
        webUrl: 'https://1drv.ms/x',
      });
      const { url, init } = appel(0);
      expect(init.method).toBe('PUT');
      expect(url).toContain('/me/drive/special/approot:/');
      expect(url).toContain(
        'Adresse%201/L%C3%A9a%20T/entree/Chambre/Murs-1.jpg:/content',
      );
      expect(url).toContain('conflictBehavior=rename');
      expect(init.headers.authorization).toBe('Bearer JETON');
      expect(init.headers['content-type']).toBe('image/jpeg');
    });

    it('n’écrit jamais hors du dossier applicatif', async () => {
      fetchMock.mockResolvedValueOnce(json({ id: 'ITEM1' }, 201));

      await service.televerser('a/b.jpg', Buffer.from('x'), 'image/jpeg');

      expect(appel(0).url).not.toContain('/me/drive/root');
      expect(appel(0).url).toContain('/special/approot:');
    });

    it('passe par une session de téléversement au-delà de 4 Mo, en morceaux', async () => {
      const taille = SEUIL_SESSION_OCTETS + 1;
      const contenu = Buffer.alloc(taille, 1);
      const morceaux = Math.ceil(taille / TAILLE_MORCEAU);
      fetchMock.mockResolvedValueOnce(
        json({ uploadUrl: 'https://upload.test/session' }),
      );
      for (let i = 0; i < morceaux - 1; i++) {
        fetchMock.mockResolvedValueOnce(json({ nextExpectedRanges: [] }, 202));
      }
      fetchMock.mockResolvedValueOnce(json({ id: 'GROS', webUrl: 'w' }, 201));

      const resultat = await service.televerser(
        'a/gros.jpg',
        contenu,
        'image/jpeg',
      );

      expect(resultat.itemId).toBe('GROS');
      expect(appel(0).url).toContain('createUploadSession');
      expect(appel(0).init.headers.authorization).toBe('Bearer JETON');
      // Les morceaux vont vers l'URL de session, SANS jeton (elle est pré-autorisée).
      expect(appel(1).url).toBe('https://upload.test/session');
      expect(appel(1).init.headers.authorization).toBeUndefined();
      expect(appel(1).init.headers['content-range']).toBe(
        `bytes 0-${TAILLE_MORCEAU - 1}/${taille}`,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1 + morceaux);
    });

    it('renouvelle le jeton une fois quand Graph répond 401', async () => {
      fetchMock
        .mockResolvedValueOnce(json({}, 401))
        .mockResolvedValueOnce(json({ id: 'ITEM2' }, 201));

      const resultat = await service.televerser(
        'a/b.jpg',
        Buffer.from('x'),
        'image/jpeg',
      );

      expect(resultat.itemId).toBe('ITEM2');
      expect(auth.invalider).toHaveBeenCalledTimes(1);
      expect(auth.accessToken).toHaveBeenCalledTimes(2);
    });
  });

  describe('erreurs : la photo n’est jamais perdue, elle est « à réessayer »', () => {
    it('transmet le Retry-After d’un 429', async () => {
      fetchMock.mockResolvedValueOnce(json({}, 429, { 'retry-after': '30' }));

      await expect(
        service.televerser('a/b.jpg', Buffer.from('x'), 'image/jpeg'),
      ).rejects.toMatchObject({ cause_: 'LIMITE', retryAfterSecondes: 30 });
    });

    it('distingue un OneDrive plein (507)', async () => {
      fetchMock.mockResolvedValueOnce(json({}, 507));

      await expect(
        service.televerser('a/b.jpg', Buffer.from('x'), 'image/jpeg'),
      ).rejects.toMatchObject({ cause_: 'QUOTA' });
    });

    it('traite une panne réseau ou un 5xx comme passagers', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(
        service.televerser('a/b.jpg', Buffer.from('x'), 'image/jpeg'),
      ).rejects.toMatchObject({ cause_: 'INDISPONIBLE' });

      fetchMock.mockResolvedValueOnce(json({}, 503));
      await expect(
        service.televerser('a/b.jpg', Buffer.from('x'), 'image/jpeg'),
      ).rejects.toMatchObject({ cause_: 'INDISPONIBLE' });
    });

    it('répercute un jeton révoqué', async () => {
      auth.accessToken.mockRejectedValueOnce(
        Object.assign(new Error('révoqué'), { cause_: 'REVOQUE' }),
      );

      await expect(
        service.televerser('a/b.jpg', Buffer.from('x'), 'image/jpeg'),
      ).rejects.toMatchObject({ cause_: 'REVOQUE' });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('suppression et lecture', () => {
    it('supprime par identifiant, un fichier déjà absent compte comme supprimé', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

      await expect(service.supprimer('ITEM/1')).resolves.toBeUndefined();

      expect(appel(0).init.method).toBe('DELETE');
      expect(appel(0).url).toContain('/me/drive/items/ITEM%2F1');
    });

    it('télécharge le contenu', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(Buffer.from('octets'), { status: 200 }),
      );

      expect((await service.telecharger('ITEM1')).toString()).toBe('octets');
      expect(appel(0).url).toContain('/me/drive/items/ITEM1/content');
    });
  });
});
