/**
 * Durée de conservation après la SORTIE du locataire (fin du bail), en années.
 * Défaut : 3 ans — ce délai couvre la prescription des actions entre bailleur et
 * locataire (art. 7-1 de la loi du 6 juillet 1989). Réglable par
 * `EDL_RETENTION_ANNEES` ; `0` supprime dès la sortie.
 */
const ANNEES_PAR_DEFAUT = 3;

export const anneesConservation = (): number => {
  const brut = process.env.EDL_RETENTION_ANNEES;
  if (brut === undefined || brut.trim() === '') {
    return ANNEES_PAR_DEFAUT;
  }

  const valeur = Number(brut);
  return Number.isInteger(valeur) && valeur >= 0 ? valeur : ANNEES_PAR_DEFAUT;
};

/** La purge automatique est active, sauf si on la coupe explicitement. */
export const purgeAutomatiqueActive = (): boolean =>
  process.env.EDL_RETENTION_ACTIVE?.trim().toLowerCase() !== 'false';

/**
 * Plafond de documents supprimés par passage : si une date était corrompue, la
 * purge ne peut pas vider toute la base d'un coup. Le reste attend le passage suivant.
 */
export const PURGE_LIMITE_PAR_PASSAGE = 100;
