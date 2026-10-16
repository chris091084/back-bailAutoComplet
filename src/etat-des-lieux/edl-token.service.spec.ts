import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  CODE_LIEN_EXPIRE,
  CODE_LIEN_INVALIDE,
  EdlTokenService,
} from './edl-token.service';

const EDL_ID = '11111111-1111-4111-8111-111111111111';
const JTI = '22222222-2222-4222-8222-222222222222';
const dansUnJour = () => new Date(Date.now() + 24 * 3600 * 1000);

describe('EdlTokenService', () => {
  const jwt = new JwtService({});
  const service = new EdlTokenService(jwt);
  const secretInitial = process.env.EDL_TOKEN_SECRET;

  beforeEach(() => {
    process.env.EDL_TOKEN_SECRET = 'secret-de-test-assez-long-pour-hs256';
  });

  afterAll(() => {
    process.env.EDL_TOKEN_SECRET = secretInitial;
  });

  it('signe un jeton qui se relit avec l’id du document et la version du lien', async () => {
    const token = await service.signer(EDL_ID, JTI, dansUnJour());

    await expect(service.verifier(token)).resolves.toEqual({
      edlId: EDL_ID,
      jti: JTI,
    });
  });

  it('refuse un jeton expiré en le nommant', async () => {
    const token = await jwt.signAsync(
      {},
      {
        secret: process.env.EDL_TOKEN_SECRET,
        subject: EDL_ID,
        jwtid: JTI,
        audience: 'edl-locataire',
        expiresIn: -10,
      },
    );

    await expect(service.verifier(token)).rejects.toMatchObject({
      response: { code: CODE_LIEN_EXPIRE },
    });
  });

  it('refuse un jeton signé avec une autre clé', async () => {
    const token = await jwt.signAsync(
      {},
      {
        secret: 'une-autre-cle',
        subject: EDL_ID,
        jwtid: JTI,
        audience: 'edl-locataire',
        expiresIn: 60,
      },
    );

    await expect(service.verifier(token)).rejects.toMatchObject({
      response: { code: CODE_LIEN_INVALIDE },
    });
  });

  it('refuse un jeton d’un autre public, même signé avec la bonne clé', async () => {
    // Un jeton de session (autre audience) ne doit jamais ouvrir un lien.
    const token = await jwt.signAsync(
      {},
      {
        secret: process.env.EDL_TOKEN_SECRET,
        subject: EDL_ID,
        jwtid: JTI,
        audience: 'autre',
        expiresIn: 60,
      },
    );

    await expect(service.verifier(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuse une chaîne qui n’est pas un jeton', async () => {
    await expect(service.verifier('123')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('construit un lien vers la page locataire du front', async () => {
    process.env.EDL_FRONT_BASE_URL = 'https://app.exemple.fr/';

    expect(service.construireLien('abc')).toBe(
      'https://app.exemple.fr/edl/abc',
    );

    delete process.env.EDL_FRONT_BASE_URL;
  });
});
