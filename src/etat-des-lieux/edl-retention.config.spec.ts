import {
  anneesConservation,
  purgeAutomatiqueActive,
} from './edl-retention.config';

describe('configuration de la rétention', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('conserve 3 ans après la sortie par défaut', () => {
    delete process.env.EDL_RETENTION_ANNEES;
    expect(anneesConservation()).toBe(3);
  });

  it('se règle par EDL_RETENTION_ANNEES, y compris 0', () => {
    process.env.EDL_RETENTION_ANNEES = '5';
    expect(anneesConservation()).toBe(5);
    process.env.EDL_RETENTION_ANNEES = '0';
    expect(anneesConservation()).toBe(0);
  });

  it('retombe sur 3 ans devant une valeur absurde plutôt que de tout supprimer', () => {
    for (const mauvaise of ['-1', 'abc', '2.5', '']) {
      process.env.EDL_RETENTION_ANNEES = mauvaise;
      expect(anneesConservation()).toBe(3);
    }
  });

  it('la purge automatique est active sauf EDL_RETENTION_ACTIVE=false', () => {
    delete process.env.EDL_RETENTION_ACTIVE;
    expect(purgeAutomatiqueActive()).toBe(true);
    process.env.EDL_RETENTION_ACTIVE = 'false';
    expect(purgeAutomatiqueActive()).toBe(false);
  });
});
