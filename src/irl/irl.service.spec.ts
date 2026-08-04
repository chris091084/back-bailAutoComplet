import { ConfigService } from '@nestjs/config';
import { IrlService } from './irl.service';

const REPONSE_SDMX = `<?xml version="1.0" encoding="UTF-8"?>
<message:StructureSpecificData xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message">
  <message:DataSet>
    <Series IDBANK="001515333">
      <Obs TIME_PERIOD="2025-Q3" OBS_VALUE="145.2"/>
      <Obs TIME_PERIOD="2026-Q1" OBS_VALUE="146.6"/>
      <Obs TIME_PERIOD="2025-Q4" OBS_VALUE="145.9"/>
    </Series>
  </message:DataSet>
</message:StructureSpecificData>`;

const configServiceStub = {
  get: (_key: string, defaultValue: string) => defaultValue,
} as unknown as ConfigService;

const mockFetch = (implementation: jest.Mock): void => {
  global.fetch = implementation as unknown as typeof fetch;
};

const reponseOk = (body: string) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(body),
});

describe('IrlService', () => {
  let service: IrlService;

  beforeEach(() => {
    service = new IrlService(configServiceStub);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("retient l'observation du trimestre le plus récent et formate le libellé", async () => {
    mockFetch(jest.fn().mockResolvedValue(reponseOk(REPONSE_SDMX)));

    await expect(service.getLatestIrl()).resolves.toEqual({
      valIrl: '146.6',
      tIrl: 'T1 2026',
    });
  });

  it("n'interroge l'INSEE qu'une fois tant que le cache est valide", async () => {
    const fetchMock = jest.fn().mockResolvedValue(reponseOk(REPONSE_SDMX));
    mockFetch(fetchMock);

    await service.getLatestIrl();
    await service.getLatestIrl();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("conserve la dernière valeur connue quand l'INSEE devient injoignable", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(reponseOk(REPONSE_SDMX))
      .mockRejectedValue(new Error('timeout'));
    mockFetch(fetchMock);

    const premier = await service.getLatestIrl();
    // On force l'expiration du cache pour déclencher un nouvel appel.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 24 * 60 * 60 * 1000);

    await expect(service.getLatestIrl()).resolves.toEqual(premier);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renvoie null sur une réponse HTTP en erreur, sans valeur en cache', async () => {
    mockFetch(jest.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(service.getLatestIrl()).resolves.toBeNull();
  });

  it('rejette une réponse contenant une déclaration DOCTYPE (anti-XXE)', async () => {
    mockFetch(
      jest
        .fn()
        .mockResolvedValue(
          reponseOk(
            '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Obs TIME_PERIOD="2026-Q1" OBS_VALUE="146.6"/>',
          ),
        ),
    );

    await expect(service.getLatestIrl()).resolves.toBeNull();
  });

  it('renvoie null quand la réponse ne contient aucune observation', async () => {
    mockFetch(jest.fn().mockResolvedValue(reponseOk('<message:DataSet/>')));

    await expect(service.getLatestIrl()).resolves.toBeNull();
  });
});
