import { randomBytes } from 'crypto';
import { chiffrer } from '../common/encryption';
import { versAncien } from './locataire-purge';

describe('versAncien (lecture des fiches par SQL brut)', () => {
  const cleInitiale = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });

  afterAll(() => {
    if (cleInitiale === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = cleInitiale;
    }
  });

  it('déchiffre nom, prénom et adresses pour le rappel au propriétaire', () => {
    const ancien = versAncien({
      id: '1',
      result_form_id: '9',
      nom: chiffrer('Dupont'),
      prenom: chiffrer('Jean'),
      email: chiffrer('jean@example.test'),
      bail_email: chiffrer('j.dupont@example.test'),
      sortie: '2020-01-01',
    });

    expect(ancien).toEqual({
      nom: 'Dupont',
      prenom: 'Jean',
      emails: ['jean@example.test', 'j.dupont@example.test'],
      sortie: '2020-01-01',
    });
  });

  it('écarte l’adresse du bail quand elle est identique à celle de la fiche, même chiffrée différemment', () => {
    const ancien = versAncien({
      id: '1',
      result_form_id: null,
      nom: chiffrer('Dupont'),
      prenom: chiffrer('Jean'),
      email: chiffrer('Jean@Example.test'),
      bail_email: chiffrer('jean@example.test'),
      sortie: null,
    });

    expect(ancien.emails).toEqual(['Jean@Example.test']);
  });

  it('lit aussi les valeurs encore en clair (avant la reprise des données)', () => {
    const ancien = versAncien({
      id: '1',
      result_form_id: null,
      nom: 'Dupont',
      prenom: 'Jean',
      email: null,
      bail_email: null,
      sortie: null,
    });

    expect(ancien).toMatchObject({ nom: 'Dupont', prenom: 'Jean', emails: [] });
  });
});
