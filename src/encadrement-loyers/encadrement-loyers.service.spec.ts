import { ConfigService } from '@nestjs/config';
import { EncadrementLoyersService } from './encadrement-loyers.service';

const configServiceStub = {
  get: (_key: string, defaultValue: string) => defaultValue,
} as unknown as ConfigService;

const VALEURS_ZONE = {
  '4 et plus': {
    '1946-1970': {
      meuble: { loyer_reference: 11.3, loyer_reference_majore: 13.6 },
      'non meuble': { loyer_reference: 9.9, loyer_reference_majore: 11.9 },
    },
    'avant 1946': {
      meuble: { loyer_reference: 12.1, loyer_reference_majore: 14.5 },
    },
  },
};

const reponseJson = (corps: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: () => Promise.resolve(corps),
});

const reponseBan = (depcode = '69', score = 0.98) =>
  reponseJson({
    features: [
      {
        geometry: { coordinates: [4.883193, 45.777595] },
        properties: { depcode, score },
      },
    ],
  });

const reponseWfs = (valeurs: unknown = VALEURS_ZONE) =>
  reponseJson({ features: [{ properties: { zonage: '5', valeurs } }] });

const WFS_VIDE = reponseJson({ features: [] });

const mockFetch = (implementation: jest.Mock): void => {
  global.fetch = implementation as unknown as typeof fetch;
};

describe('EncadrementLoyersService', () => {
  let service: EncadrementLoyersService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-07T10:00:00Z') });
    service = new EncadrementLoyersService(configServiceStub);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('epoqueConstruction', () => {
    it.each([
      ['1930', 'avant 1946'],
      ['1968', '1946-1970'],
      ['1946-1970', '1946-1970'],
      ['1971', '1971-1990'],
      ['1995', '1991-2005'],
      ['2015', 'après 2005'],
    ])('%s → %s', (entree, attendu) => {
      expect(service.epoqueConstruction(entree)).toBe(attendu);
    });

    it('renvoie null quand l’année est absente', () => {
      expect(service.epoqueConstruction(null)).toBeNull();
      expect(service.epoqueConstruction('inconnue')).toBeNull();
    });
  });

  it('géocode l’adresse puis lit la ligne « 4 pièces et plus, meublé »', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(reponseBan())
      .mockResolvedValueOnce(reponseWfs());
    mockFetch(fetchMock);

    const resultat = await service.getLoyersReference(
      '56 rue de la Filature - 69100 VILLEURBANNE',
      '1968',
    );

    expect(resultat).toEqual({ rentRef: 11.3, rentRefMaj: 13.6 });

    const urlWfs = (fetchMock.mock.calls[1] as [URL])[0];
    // Novembre 2026 : l'arrêté 2026-2027 est en vigueur.
    expect(urlWfs.searchParams.get('typename')).toContain('_2026_2027');
    expect(urlWfs.searchParams.get('CQL_FILTER')).toBe(
      'INTERSECTS(the_geom,POINT(45.777595 4.883193))',
    );
  });

  it('accepte des « valeurs » renvoyées sous forme de chaîne JSON', async () => {
    mockFetch(
      jest
        .fn()
        .mockResolvedValueOnce(reponseBan())
        .mockResolvedValueOnce(reponseWfs(JSON.stringify(VALEURS_ZONE))),
    );

    await expect(
      service.getLoyersReference('1 rue René', '1946-1970'),
    ).resolves.toEqual({ rentRef: 11.3, rentRefMaj: 13.6 });
  });

  it('utilise encore l’arrêté de l’année précédente avant le 1er novembre', async () => {
    jest.setSystemTime(new Date('2026-06-15T10:00:00Z'));
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(reponseBan())
      .mockResolvedValueOnce(reponseWfs());
    mockFetch(fetchMock);

    await service.getLoyersReference('1 rue René', '1968');

    const urlWfs = (fetchMock.mock.calls[1] as [URL])[0];
    expect(urlWfs.searchParams.get('typename')).toContain('_2025_2026');
  });

  it('retombe sur l’arrêté précédent si le jeu de données n’est pas publié', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(reponseBan())
      .mockResolvedValueOnce(reponseJson({}, 400))
      .mockResolvedValueOnce(reponseWfs());
    mockFetch(fetchMock);

    const resultat = await service.getLoyersReference('1 rue René', '1968');

    expect(resultat).toEqual({ rentRef: 11.3, rentRefMaj: 13.6 });
    expect(
      (fetchMock.mock.calls[2] as [URL])[0].searchParams.get('typename'),
    ).toContain('_2025_2026');
  });

  it('renvoie null hors de la zone encadrée, sans remonter aux anciens arrêtés', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(reponseBan())
      .mockResolvedValueOnce(WFS_VIDE);
    mockFetch(fetchMock);

    await expect(
      service.getLoyersReference('1 rue René', '1968'),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retente sans le suffixe du numéro quand la BAN ne trouve rien', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(reponseBan('26', 0.62))
      .mockResolvedValueOnce(reponseBan())
      .mockResolvedValueOnce(reponseWfs());
    mockFetch(fetchMock);

    const resultat = await service.getLoyersReference(
      '53A bis rue Château Gaillard',
      '1959',
    );

    expect(resultat).toEqual({ rentRef: 11.3, rentRefMaj: 13.6 });
    expect((fetchMock.mock.calls[0] as [URL])[0].searchParams.get('q')).toBe(
      '53A bis rue Château Gaillard',
    );
    expect((fetchMock.mock.calls[1] as [URL])[0].searchParams.get('q')).toBe(
      '53 rue Château Gaillard',
    );
  });

  it('renvoie null quand la BAN ne trouve aucune adresse du Rhône', async () => {
    const fetchMock = jest.fn().mockResolvedValue(reponseBan('78'));
    mockFetch(fetchMock);

    await expect(
      service.getLoyersReference('1 rue René', '1968'),
    ).resolves.toBeNull();
    // Pas de WFS : seule la BAN a été interrogée (« 1 rue René » n'a pas de
    // suffixe à retirer).
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renvoie null quand la ligne du tableau n’existe pas', async () => {
    mockFetch(
      jest
        .fn()
        .mockResolvedValueOnce(reponseBan())
        .mockResolvedValueOnce(reponseWfs()),
    );

    // « 1971-1990 » n'existe pas dans VALEURS_ZONE.
    await expect(
      service.getLoyersReference('1 rue René', '1980'),
    ).resolves.toBeNull();
  });

  it('ne fait aucun appel réseau sans époque de construction', async () => {
    const fetchMock = jest.fn();
    mockFetch(fetchMock);

    await expect(
      service.getLoyersReference('1 rue René', null),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('met le résultat en cache', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(reponseBan())
      .mockResolvedValueOnce(reponseWfs());
    mockFetch(fetchMock);

    await service.getLoyersReference('1 rue René', '1968');
    await service.getLoyersReference('1 rue René', '1968');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('regroupe les requêtes simultanées pour une même adresse', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(reponseBan())
      .mockResolvedValueOnce(reponseWfs());
    mockFetch(fetchMock);

    const [a, b] = await Promise.all([
      service.getLoyersReference('1 rue René', '1968'),
      service.getLoyersReference('1 rue René', '1968'),
    ]);

    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renvoie null sans lever d’erreur quand le réseau échoue', async () => {
    mockFetch(jest.fn().mockRejectedValue(new Error('réseau coupé')));
    jest.spyOn(service['logger'], 'warn').mockImplementation();

    await expect(
      service.getLoyersReference('1 rue René', '1968'),
    ).resolves.toBeNull();
  });

  it('renvoie la valeur expirée quand le réseau échoue ensuite', async () => {
    mockFetch(
      jest
        .fn()
        .mockResolvedValueOnce(reponseBan())
        .mockResolvedValueOnce(reponseWfs()),
    );
    await service.getLoyersReference('1 rue René', '1968');

    jest.setSystemTime(new Date('2026-11-09T10:00:00Z')); // cache de 24 h expiré
    mockFetch(jest.fn().mockRejectedValue(new Error('réseau coupé')));
    jest.spyOn(service['logger'], 'warn').mockImplementation();

    await expect(
      service.getLoyersReference('1 rue René', '1968'),
    ).resolves.toEqual({ rentRef: 11.3, rentRefMaj: 13.6 });
  });
});
