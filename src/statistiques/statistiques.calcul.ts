import { EtatLocataire } from '../locataire/locataire-etat.enum';

/** Ce dont le calcul a besoin : aucune identité, seulement des attributs. */
export interface FicheStat {
  etat: EtatLocataire;
  dateNaissance: string | null;
  profession: string | null;
  entree: string | null;
  sortie: string | null;
}

export interface ResumeNombres {
  /** Combien de fiches ont fourni une valeur exploitable. */
  renseignes: number;
  moyenne: number | null;
  mediane: number | null;
  min: number | null;
  max: number | null;
}

export interface StatistiquesLocataires {
  population: { enPlace: number; sortis: number; total: number };
  /** Âge en années révolues, locataires en place et sortis confondus. */
  age: ResumeNombres & {
    manquants: number;
    tranches: { tranche: string; nombre: number }[];
  };
  professions: { profession: string; nombre: number }[];
  entrees: {
    parAnnee: { annee: number; nombre: number }[];
    /** Les 12 mois de l'année civile, tous millésimes confondus (saisonnalité). */
    parMois: { mois: number; nombre: number }[];
    manquantes: number;
  };
  /** Durée de séjour en mois : jusqu'à la sortie, ou jusqu'à aujourd'hui. */
  duree: { sortis: ResumeNombres; enPlace: ResumeNombres };
}

export const NON_RENSEIGNEE = 'Non renseignée';

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
const JOURS_PAR_MOIS = 30.4375;

const arrondi = (valeur: number): number => Math.round(valeur * 10) / 10;

/** « AAAA-MM-JJ » → date UTC, ou `null` si la chaîne n'est pas un vrai jour. */
const lireJour = (valeur: string | null): Date | null => {
  if (!valeur || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    return null;
  }

  const date = new Date(`${valeur}T00:00:00Z`);

  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== valeur
    ? null
    : date;
};

const mediane = (valeurs: number[]): number => {
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);

  return triees.length % 2 === 0
    ? (triees[milieu - 1] + triees[milieu]) / 2
    : triees[milieu];
};

const resumer = (valeurs: number[]): ResumeNombres =>
  valeurs.length === 0
    ? { renseignes: 0, moyenne: null, mediane: null, min: null, max: null }
    : {
        renseignes: valeurs.length,
        moyenne: arrondi(valeurs.reduce((a, b) => a + b, 0) / valeurs.length),
        mediane: arrondi(mediane(valeurs)),
        min: arrondi(Math.min(...valeurs)),
        max: arrondi(Math.max(...valeurs)),
      };

const ageEnAnnees = (naissance: Date, aujourdhui: Date): number => {
  let age = aujourdhui.getUTCFullYear() - naissance.getUTCFullYear();
  const anniversairePasse =
    aujourdhui.getUTCMonth() > naissance.getUTCMonth() ||
    (aujourdhui.getUTCMonth() === naissance.getUTCMonth() &&
      aujourdhui.getUTCDate() >= naissance.getUTCDate());

  if (!anniversairePasse) {
    age -= 1;
  }

  return age;
};

const moisEntre = (debut: Date, fin: Date): number =>
  (fin.getTime() - debut.getTime()) / MS_PAR_JOUR / JOURS_PAR_MOIS;

/** Deux écritures qui ne diffèrent que par la casse, les accents ou les espaces comptent pour une. */
const cleProfession = (profession: string): string =>
  profession
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');

const TRANCHES = [
  { libelle: 'Moins de 25 ans', contient: (age: number) => age < 25 },
  { libelle: '25 à 34 ans', contient: (age: number) => age >= 25 && age < 35 },
  { libelle: '35 à 44 ans', contient: (age: number) => age >= 35 && age < 45 },
  { libelle: '45 ans et plus', contient: (age: number) => age >= 45 },
];

/**
 * Statistiques sur les locataires signés (en place ou sortis) : les candidats,
 * qui n'ont jamais signé, n'entrent dans aucun chiffre.
 *
 * Calculées ici, en mémoire, et non en SQL : nom, profession et date de naissance
 * sont chiffrés en base, seule l'application sait les lire. Le résultat ne contient
 * que des nombres et des catégories, jamais un nom ni une adresse.
 *
 * Une valeur absente, mal formée, ou incohérente (une sortie avant l'entrée, une
 * naissance dans le futur) est écartée du calcul concerné : `renseignes` dit sur
 * combien de fiches il repose.
 */
export function calculerStatistiques(
  fiches: FicheStat[],
  aujourdhui: Date = new Date(),
): StatistiquesLocataires {
  const signees = fiches.filter(
    (fiche) =>
      fiche.etat === EtatLocataire.LOCATAIRE ||
      fiche.etat === EtatLocataire.SORTI,
  );
  const enPlace = signees.filter((f) => f.etat === EtatLocataire.LOCATAIRE);
  const sortis = signees.filter((f) => f.etat === EtatLocataire.SORTI);
  const aujourdhuiUtc = new Date(
    Date.UTC(
      aujourdhui.getUTCFullYear(),
      aujourdhui.getUTCMonth(),
      aujourdhui.getUTCDate(),
    ),
  );

  // --- âge
  const ages = signees
    .map((fiche) => lireJour(fiche.dateNaissance))
    .filter(
      (naissance): naissance is Date =>
        naissance !== null && naissance <= aujourdhuiUtc,
    )
    .map((naissance) => ageEnAnnees(naissance, aujourdhuiUtc));

  // --- professions : on garde l'écriture la plus fréquente de chaque groupe
  const groupes = new Map<string, Map<string, number>>();
  let sansProfession = 0;
  for (const fiche of signees) {
    const brute = fiche.profession?.trim();
    if (!brute) {
      sansProfession += 1;
      continue;
    }
    const cle = cleProfession(brute);
    const ecritures = groupes.get(cle) ?? new Map<string, number>();
    ecritures.set(brute, (ecritures.get(brute) ?? 0) + 1);
    groupes.set(cle, ecritures);
  }
  const professions = [...groupes.values()]
    .map((ecritures) => ({
      profession: [...ecritures.entries()].sort((a, b) => b[1] - a[1])[0][0],
      nombre: [...ecritures.values()].reduce((a, b) => a + b, 0),
    }))
    .sort(
      (a, b) =>
        b.nombre - a.nombre || a.profession.localeCompare(b.profession, 'fr'),
    );
  if (sansProfession > 0) {
    professions.push({ profession: NON_RENSEIGNEE, nombre: sansProfession });
  }

  // --- entrées
  const parAnnee = new Map<number, number>();
  const parMois = new Array<number>(12).fill(0);
  let entreesManquantes = 0;
  for (const fiche of signees) {
    const entree = lireJour(fiche.entree);
    if (!entree) {
      entreesManquantes += 1;
      continue;
    }
    parAnnee.set(
      entree.getUTCFullYear(),
      (parAnnee.get(entree.getUTCFullYear()) ?? 0) + 1,
    );
    parMois[entree.getUTCMonth()] += 1;
  }

  // --- durée de séjour
  const dureeJusqua = (fiche: FicheStat, fin: Date): number | null => {
    const entree = lireJour(fiche.entree);
    return entree && fin >= entree ? moisEntre(entree, fin) : null;
  };
  const dureesSortis = sortis
    .map((fiche) => {
      const sortie = lireJour(fiche.sortie);
      return sortie ? dureeJusqua(fiche, sortie) : null;
    })
    .filter((duree): duree is number => duree !== null);
  const dureesEnPlace = enPlace
    .map((fiche) => dureeJusqua(fiche, aujourdhuiUtc))
    .filter((duree): duree is number => duree !== null);

  return {
    population: {
      enPlace: enPlace.length,
      sortis: sortis.length,
      total: signees.length,
    },
    age: {
      ...resumer(ages),
      manquants: signees.length - ages.length,
      tranches: TRANCHES.map(({ libelle, contient }) => ({
        tranche: libelle,
        nombre: ages.filter(contient).length,
      })),
    },
    professions,
    entrees: {
      parAnnee: [...parAnnee.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([annee, nombre]) => ({ annee, nombre })),
      parMois: parMois.map((nombre, index) => ({ mois: index + 1, nombre })),
      manquantes: entreesManquantes,
    },
    duree: { sortis: resumer(dureesSortis), enPlace: resumer(dureesEnPlace) },
  };
}
