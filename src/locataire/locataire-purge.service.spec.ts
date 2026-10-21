import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { MailService } from '../mail/mail.service';
import {
  composerRappelPurge,
  LocatairePurgeService,
  OBJET_RAPPEL_PURGE,
} from './locataire-purge.service';
import { BilanPurge, purgerLocatairesSortis } from './locataire-purge';

jest.mock('./locataire-purge', () => ({
  DELAI_CONSERVATION_ANNEES: 3,
  purgerLocatairesSortis: jest.fn(),
}));

const purgerMock = jest.mocked(purgerLocatairesSortis);

const bilanVide: BilanPurge = {
  locataires: 0,
  baux: 0,
  generations: 0,
  anciens: [],
};

const bilanDUnLocataire: BilanPurge = {
  locataires: 1,
  baux: 1,
  generations: 1,
  anciens: [
    {
      nom: 'Dupont',
      prenom: 'Jean',
      emails: ['jean@example.test'],
      sortie: '2020-01-01',
    },
  ],
};

/** Laisse la purge, lancée sans attente au démarrage, se terminer. */
const attendrePurge = () => new Promise((resolve) => setImmediate(resolve));

describe('LocatairePurgeService', () => {
  const proprietaire = process.env.AUTH_OWNER_EMAIL;
  let mail: { envoyer: jest.Mock };

  const creerService = (valeur?: string): LocatairePurgeService =>
    new LocatairePurgeService(
      {} as DataSource,
      { get: jest.fn().mockReturnValue(valeur) } as unknown as ConfigService,
      mail as unknown as MailService,
    );

  beforeEach(() => {
    purgerMock.mockReset();
    purgerMock.mockResolvedValue(bilanVide);
    mail = { envoyer: jest.fn().mockResolvedValue(undefined) };
    process.env.AUTH_OWNER_EMAIL = 'proprio@example.test';
  });

  afterAll(() => {
    if (proprietaire === undefined) {
      delete process.env.AUTH_OWNER_EMAIL;
    } else {
      process.env.AUTH_OWNER_EMAIL = proprietaire;
    }
  });

  it('ne supprime rien tant que PURGE_LOCATAIRES n’est pas à true', () => {
    creerService().onApplicationBootstrap();
    creerService('false').onApplicationBootstrap();

    expect(purgerMock).not.toHaveBeenCalled();
  });

  it('lance une vraie purge (pas un essai à blanc) quand PURGE_LOCATAIRES=true', () => {
    creerService('true').onApplicationBootstrap();

    expect(purgerMock).toHaveBeenCalledWith(expect.anything(), {
      executer: true,
    });
  });

  it('n’empêche pas le démarrage si la purge échoue', async () => {
    purgerMock.mockRejectedValue(new Error('base indisponible'));

    expect(() => creerService('true').onApplicationBootstrap()).not.toThrow();
    await attendrePurge();

    expect(mail.envoyer).not.toHaveBeenCalled();
  });

  describe('rappel après suppression', () => {
    it('n’envoie aucun mail quand rien n’a été supprimé', async () => {
      creerService('true').onApplicationBootstrap();
      await attendrePurge();

      expect(mail.envoyer).not.toHaveBeenCalled();
    });

    it('envoie au propriétaire la liste de ceux qui viennent de partir', async () => {
      purgerMock.mockResolvedValue(bilanDUnLocataire);

      creerService('true').onApplicationBootstrap();
      await attendrePurge();

      expect(mail.envoyer).toHaveBeenCalledTimes(1);
      const message = mail.envoyer.mock.calls[0][0];
      expect(message.to).toBe('proprio@example.test');
      expect(message.subject).toBe(OBJET_RAPPEL_PURGE);
      expect(message.text).toContain('Jean Dupont');
      expect(message.text).toContain('jean@example.test');
    });

    it('écarte la copie cachée d’archivage', async () => {
      purgerMock.mockResolvedValue(bilanDUnLocataire);

      creerService('true').onApplicationBootstrap();
      await attendrePurge();

      expect(mail.envoyer).toHaveBeenCalledWith(
        expect.objectContaining({ sansCopie: true }),
      );
    });

    it('écrit aux deux propriétaires quand il y en a deux', async () => {
      process.env.AUTH_OWNER_EMAIL = 'a@example.test, b@example.test';
      purgerMock.mockResolvedValue(bilanDUnLocataire);

      creerService('true').onApplicationBootstrap();
      await attendrePurge();

      expect(mail.envoyer.mock.calls[0][0].to).toBe(
        'a@example.test, b@example.test',
      );
    });

    it('n’envoie rien si aucune adresse de propriétaire n’est configurée', async () => {
      delete process.env.AUTH_OWNER_EMAIL;
      purgerMock.mockResolvedValue(bilanDUnLocataire);

      creerService('true').onApplicationBootstrap();
      await attendrePurge();

      expect(mail.envoyer).not.toHaveBeenCalled();
    });

    it('ne fait pas échouer la purge si le mail ne part pas', async () => {
      purgerMock.mockResolvedValue(bilanDUnLocataire);
      mail.envoyer.mockRejectedValue(new Error('SMTP indisponible'));

      expect(() => creerService('true').onApplicationBootstrap()).not.toThrow();
      await attendrePurge();

      expect(mail.envoyer).toHaveBeenCalledTimes(1);
    });
  });
});

describe('composerRappelPurge', () => {
  it('liste chaque personne avec ses adresses et sa date de sortie', () => {
    const texte = composerRappelPurge([
      {
        nom: 'Dupont',
        prenom: 'Jean',
        emails: ['jean@example.test', 'j.dupont@example.test'],
        sortie: '2020-01-01',
      },
      { nom: 'Martin', prenom: 'Léa', emails: [], sortie: '2019-06-30' },
    ]);

    expect(texte).toContain(
      '- Jean Dupont : jean@example.test, j.dupont@example.test, sortie le 2020-01-01',
    );
    expect(texte).toContain('- Léa Martin : aucune adresse enregistrée');
  });

  it('demande de supprimer le message lui-même avec le reste', () => {
    expect(composerRappelPurge([])).toContain('supprime-le avec le reste');
  });

  it('ne met aucune donnée personnelle dans l’objet', () => {
    expect(OBJET_RAPPEL_PURGE).not.toMatch(/@/);
  });
});
