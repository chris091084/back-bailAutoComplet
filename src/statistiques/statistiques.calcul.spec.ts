import { EtatLocataire } from '../locataire/locataire-etat.enum';
import {
  calculerStatistiques,
  FicheStat,
  NON_RENSEIGNEE,
} from './statistiques.calcul';

const AUJOURDHUI = new Date('2026-10-21T12:00:00Z');

const fiche = (surcharge: Partial<FicheStat> = {}): FicheStat => ({
  etat: EtatLocataire.LOCATAIRE,
  dateNaissance: null,
  profession: null,
  entree: null,
  sortie: null,
  ...surcharge,
});

describe('calculerStatistiques', () => {
  describe('population', () => {
    it('compte les locataires en place et les sortis, jamais les candidats', () => {
      const stats = calculerStatistiques(
        [
          fiche(),
          fiche(),
          fiche({ etat: EtatLocataire.SORTI }),
          fiche({ etat: EtatLocataire.CANDIDAT, profession: 'Candidat' }),
        ],
        AUJOURDHUI,
      );

      expect(stats.population).toEqual({ enPlace: 2, sortis: 1, total: 3 });
      expect(stats.professions.map((p) => p.profession)).not.toContain(
        'Candidat',
      );
    });

    it('ne plante pas sans aucune fiche', () => {
      const stats = calculerStatistiques([], AUJOURDHUI);

      expect(stats.population.total).toBe(0);
      expect(stats.age.moyenne).toBeNull();
      expect(stats.duree.sortis.moyenne).toBeNull();
      expect(stats.professions).toEqual([]);
      expect(stats.entrees.parAnnee).toEqual([]);
      expect(stats.entrees.parMois).toHaveLength(12);
    });
  });

  describe('âge', () => {
    it('compte les années révolues : l’anniversaire du jour est passé, celui de demain non', () => {
      const stats = calculerStatistiques(
        [
          fiche({ dateNaissance: '1990-10-21' }),
          fiche({ dateNaissance: '1990-10-22' }),
        ],
        AUJOURDHUI,
      );

      expect(stats.age.min).toBe(35);
      expect(stats.age.max).toBe(36);
      expect(stats.age.moyenne).toBe(35.5);
    });

    it('donne moyenne, médiane, et signale les dates manquantes', () => {
      const stats = calculerStatistiques(
        [
          fiche({ dateNaissance: '2004-01-01' }), // 22
          fiche({ dateNaissance: '2002-01-01' }), // 24
          fiche({ dateNaissance: '1986-01-01' }), // 40
          fiche(),
        ],
        AUJOURDHUI,
      );

      expect(stats.age).toMatchObject({
        renseignes: 3,
        manquants: 1,
        moyenne: 28.7,
        mediane: 24,
      });
    });

    it('répartit en tranches larges', () => {
      const stats = calculerStatistiques(
        [
          fiche({ dateNaissance: '2004-01-01' }), // 22
          fiche({ dateNaissance: '2003-01-01' }), // 23
          fiche({ dateNaissance: '1995-01-01' }), // 31
          fiche({ dateNaissance: '1990-01-01' }), // 36
          fiche({ dateNaissance: '1960-01-01' }), // 66
        ],
        AUJOURDHUI,
      );

      expect(stats.age.tranches).toEqual([
        { tranche: 'Moins de 25 ans', nombre: 2 },
        { tranche: '25 à 34 ans', nombre: 1 },
        { tranche: '35 à 44 ans', nombre: 1 },
        { tranche: '45 ans et plus', nombre: 1 },
      ]);
    });

    it('écarte une date mal formée ou dans le futur', () => {
      const stats = calculerStatistiques(
        [
          fiche({ dateNaissance: '2999-01-01' }),
          fiche({ dateNaissance: '31/12/1990' }),
          fiche({ dateNaissance: '1990-02-31' }),
        ],
        AUJOURDHUI,
      );

      expect(stats.age.renseignes).toBe(0);
      expect(stats.age.manquants).toBe(3);
    });
  });

  describe('professions', () => {
    it('regroupe les écritures qui ne diffèrent que par la casse, les accents ou les espaces', () => {
      const stats = calculerStatistiques(
        [
          fiche({ profession: 'Étudiant' }),
          fiche({ profession: 'étudiant' }),
          fiche({ profession: ' ETUDIANT ' }),
          fiche({ profession: 'Infirmière' }),
        ],
        AUJOURDHUI,
      );

      expect(stats.professions).toEqual([
        { profession: 'Étudiant', nombre: 3 },
        { profession: 'Infirmière', nombre: 1 },
      ]);
    });

    it('trie du plus fréquent au moins fréquent et met « non renseignée » en dernier', () => {
      const stats = calculerStatistiques(
        [
          fiche({ profession: 'Ingénieur' }),
          fiche({ profession: 'Étudiant' }),
          fiche({ profession: 'Étudiant' }),
          fiche({ profession: '   ' }),
          fiche(),
        ],
        AUJOURDHUI,
      );

      expect(stats.professions).toEqual([
        { profession: 'Étudiant', nombre: 2 },
        { profession: 'Ingénieur', nombre: 1 },
        { profession: NON_RENSEIGNEE, nombre: 2 },
      ]);
    });
  });

  describe('dates d’entrée', () => {
    it('répartit par année et par mois, et signale les entrées manquantes', () => {
      const stats = calculerStatistiques(
        [
          fiche({ entree: '2024-09-01' }),
          fiche({ entree: '2025-09-15' }),
          fiche({ entree: '2025-02-01', etat: EtatLocataire.SORTI }),
          fiche(),
        ],
        AUJOURDHUI,
      );

      expect(stats.entrees.parAnnee).toEqual([
        { annee: 2024, nombre: 1 },
        { annee: 2025, nombre: 2 },
      ]);
      expect(stats.entrees.parMois[8]).toEqual({ mois: 9, nombre: 2 });
      expect(stats.entrees.parMois[1]).toEqual({ mois: 2, nombre: 1 });
      expect(stats.entrees.manquantes).toBe(1);
    });
  });

  describe('temps passé', () => {
    it('mesure les sortis de l’entrée à la sortie', () => {
      const stats = calculerStatistiques(
        [
          fiche({
            etat: EtatLocataire.SORTI,
            entree: '2024-01-01',
            sortie: '2025-01-01',
          }),
        ],
        AUJOURDHUI,
      );

      expect(stats.duree.sortis.renseignes).toBe(1);
      expect(stats.duree.sortis.moyenne).toBe(12);
    });

    it('mesure ceux en place de l’entrée à aujourd’hui', () => {
      const stats = calculerStatistiques(
        [fiche({ entree: '2025-10-21' })],
        AUJOURDHUI,
      );

      expect(stats.duree.enPlace.moyenne).toBe(12);
    });

    it('écarte une sortie antérieure à l’entrée, ou une sortie sans date', () => {
      const stats = calculerStatistiques(
        [
          fiche({
            etat: EtatLocataire.SORTI,
            entree: '2025-01-01',
            sortie: '2024-01-01',
          }),
          fiche({ etat: EtatLocataire.SORTI, entree: '2025-01-01' }),
        ],
        AUJOURDHUI,
      );

      expect(stats.duree.sortis.renseignes).toBe(0);
      expect(stats.duree.sortis.moyenne).toBeNull();
    });

    it('ne mélange pas les sortis et ceux en place', () => {
      const stats = calculerStatistiques(
        [
          fiche({
            etat: EtatLocataire.SORTI,
            entree: '2024-01-01',
            sortie: '2025-01-01',
          }),
          fiche({ entree: '2025-10-21' }),
        ],
        AUJOURDHUI,
      );

      expect(stats.duree.sortis.renseignes).toBe(1);
      expect(stats.duree.enPlace.renseignes).toBe(1);
    });
  });

  it('ne contient aucun nom ni adresse dans le résultat', () => {
    const stats = calculerStatistiques(
      [
        fiche({
          profession: 'Étudiant',
          dateNaissance: '2000-01-01',
          entree: '2024-09-01',
        }),
      ],
      AUJOURDHUI,
    );

    expect(Object.keys(stats).sort()).toEqual([
      'age',
      'duree',
      'entrees',
      'population',
      'professions',
    ]);
    expect(JSON.stringify(stats)).not.toMatch(/@/);
    expect(JSON.stringify(stats)).not.toMatch(
      /"(nom|prenom|email|telephone|adresse)"/i,
    );
  });
});
