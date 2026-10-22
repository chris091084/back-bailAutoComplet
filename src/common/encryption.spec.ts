import { randomBytes } from 'crypto';
import { encryptedTransformer } from './encrypted.transformer';
import {
  chiffrer,
  dechiffrer,
  empreinteCle,
  estChiffree,
  etatValeur,
  PREFIXE_CHIFFRE,
  verifierConfigurationChiffrement,
} from './encryption';

const nouvelleCle = () => randomBytes(32).toString('base64');

describe('chiffrement des colonnes', () => {
  const cleInitiale = process.env.ENCRYPTION_KEY;
  const precedenteInitiale = process.env.ENCRYPTION_KEY_PREVIOUS;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = nouvelleCle();
    delete process.env.ENCRYPTION_KEY_PREVIOUS;
  });

  afterAll(() => {
    const restaurer = (nom: string, valeur?: string) =>
      valeur === undefined
        ? delete process.env[nom]
        : (process.env[nom] = valeur);
    restaurer('ENCRYPTION_KEY', cleInitiale);
    restaurer('ENCRYPTION_KEY_PREVIOUS', precedenteInitiale);
  });

  it('rend la valeur d’origine après un aller-retour', () => {
    for (const texte of [
      'Dupont',
      'jean.dupont@example.test',
      '1990-05-17',
      '',
      'é à ç — 日本',
    ]) {
      expect(dechiffrer(chiffrer(texte))).toBe(texte);
    }
  });

  it('ne laisse rien de lisible dans la valeur stockée', () => {
    const stocke = chiffrer('Dupont');

    expect(stocke.startsWith(PREFIXE_CHIFFRE)).toBe(true);
    expect(stocke).not.toContain('Dupont');
  });

  it('donne deux textes différents pour la même valeur (IV aléatoire)', () => {
    expect(chiffrer('Dupont')).not.toBe(chiffrer('Dupont'));
  });

  it('lit tel quel ce qui n’est pas chiffré (données d’avant la reprise)', () => {
    expect(dechiffrer('Dupont')).toBe('Dupont');
    expect(estChiffree('Dupont')).toBe(false);
    expect(etatValeur('Dupont')).toBe('clair');
  });

  it('refuse une valeur altérée plutôt que de rendre n’importe quoi', () => {
    const stocke = chiffrer('Dupont');
    const altere = stocke.slice(0, -2) + (stocke.endsWith('AA') ? 'BB' : 'AA');

    expect(() => dechiffrer(altere)).toThrow(/illisible/);
  });

  it('refuse de lire avec une autre clé', () => {
    const stocke = chiffrer('Dupont');
    process.env.ENCRYPTION_KEY = nouvelleCle();

    expect(() => dechiffrer(stocke)).toThrow(/illisible/);
  });

  describe('changement de clé', () => {
    it('lit une valeur de l’ancienne clé et la signale à rechiffrer', () => {
      const ancienne = process.env.ENCRYPTION_KEY as string;
      const stocke = chiffrer('Dupont');

      process.env.ENCRYPTION_KEY = nouvelleCle();
      process.env.ENCRYPTION_KEY_PREVIOUS = ancienne;

      expect(dechiffrer(stocke)).toBe('Dupont');
      expect(etatValeur(stocke)).toBe('precedente');
      expect(etatValeur(chiffrer('Dupont'))).toBe('courante');
    });

    it('écrit toujours avec la clé courante, jamais avec l’ancienne', () => {
      const ancienne = process.env.ENCRYPTION_KEY as string;
      process.env.ENCRYPTION_KEY = nouvelleCle();
      process.env.ENCRYPTION_KEY_PREVIOUS = ancienne;
      const stocke = chiffrer('Dupont');

      delete process.env.ENCRYPTION_KEY_PREVIOUS;

      expect(dechiffrer(stocke)).toBe('Dupont');
    });
  });

  describe('configuration', () => {
    it('refuse de démarrer sans clé, avec un message qui dit quoi faire', () => {
      delete process.env.ENCRYPTION_KEY;

      expect(() => verifierConfigurationChiffrement()).toThrow(
        /ENCRYPTION_KEY est absent/,
      );
    });

    it('refuse une clé qui ne fait pas 32 octets', () => {
      process.env.ENCRYPTION_KEY = randomBytes(16).toString('base64');

      expect(() => chiffrer('Dupont')).toThrow(/32 octets/);
    });

    it('donne une empreinte courte qui ne révèle pas la clé', () => {
      const empreinte = empreinteCle();

      expect(empreinte).toMatch(/^[0-9a-f]{8}$/);
      expect(process.env.ENCRYPTION_KEY).not.toContain(empreinte);
    });

    it('donne la même empreinte pour la même clé, une autre pour une autre', () => {
      const premiere = empreinteCle();
      expect(empreinteCle()).toBe(premiere);

      process.env.ENCRYPTION_KEY = nouvelleCle();
      expect(empreinteCle()).not.toBe(premiere);
    });
  });

  describe('transformer TypeORM', () => {
    const transformer = encryptedTransformer as {
      to: (v?: unknown) => unknown;
      from: (v?: unknown) => unknown;
    };

    it('chiffre à l’écriture et déchiffre à la lecture', () => {
      const stocke = transformer.to('Dupont');

      expect(estChiffree(stocke)).toBe(true);
      expect(transformer.from(stocke)).toBe('Dupont');
    });

    it('laisse passer null et undefined (colonnes facultatives)', () => {
      expect(transformer.to(null)).toBeNull();
      expect(transformer.to(undefined)).toBeUndefined();
      expect(transformer.from(null)).toBeNull();
    });

    it('ne touche pas à une valeur qui n’est pas une chaîne', () => {
      const operateur = { _type: 'like' };

      expect(transformer.to(operateur)).toBe(operateur);
    });
  });
});
