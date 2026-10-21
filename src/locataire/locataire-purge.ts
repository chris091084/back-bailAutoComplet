import { DataSource, QueryRunner } from 'typeorm';
import { EtatLocataire } from './locataire-etat.enum';

/**
 * Délai de conservation d'un locataire après sa sortie : 3 ans, la prescription
 * des actions nées d'un bail (loi du 6 juillet 1989, art. 7-1). Passé ce délai,
 * plus aucun litige n'est à craindre, la fiche n'a plus de raison d'être gardée
 * (RGPD, art. 5.1.e : limitation de la conservation).
 *
 * À relire avec le registre des traitements (`doc-registre-traitements.md`) :
 * les pièces comptables et fiscales peuvent, elles, se garder plus longtemps.
 */
export const DELAI_CONSERVATION_ANNEES = 3;

export interface BilanPurge {
  /** Fiches `locataire` supprimées. */
  locataires: number;
  /** Baux (`result_form`) supprimés : ceux que plus aucun locataire ne référence. */
  baux: number;
  /** Historiques de génération (`generation`) supprimés avec leur bail. */
  generations: number;
  /**
   * Qui vient d'être supprimé, pour rappeler au propriétaire d'effacer aussi les
   * échanges (mails, SMS) que la base ne contient pas. À ne jamais journaliser.
   */
  anciens: AncienLocataire[];
}

export interface AncienLocataire {
  nom: string;
  prenom: string;
  /** Adresses à chercher dans la boîte mail : celle de la fiche et celle du bail. */
  emails: string[];
  /** Date de sortie, « AAAA-MM-JJ » ; `null` pour un candidat. */
  sortie: string | null;
}

/** Colonnes lues avant suppression : après, il ne resterait rien à rappeler. */
interface FicheASupprimer {
  id: string;
  result_form_id: string | null;
  nom: string;
  prenom: string;
  email: string | null;
  bail_email: string | null;
  sortie: string | null;
}

/** Les mêmes colonnes pour toutes les fiches, avec la sortie rendue en texte. */
const COLONNES_FICHE = `l."id", l."result_form_id", l."nom", l."prenom", l."email",
         rf."email" AS bail_email, to_char(l."sortie", 'YYYY-MM-DD') AS sortie`;

const versAncien = (fiche: FicheASupprimer): AncienLocataire => {
  const vus = new Set<string>();
  const emails = [fiche.email, fiche.bail_email].filter(
    (adresse): adresse is string => {
      const propre = adresse?.trim().toLowerCase();
      if (!propre || vus.has(propre)) {
        return false;
      }
      vus.add(propre);
      return true;
    },
  );

  return {
    nom: fiche.nom,
    prenom: fiche.prenom,
    emails: emails.map((adresse) => adresse.trim()),
    sortie: fiche.sortie,
  };
};

/**
 * Supprime ces fiches `locataire` avec les données personnelles qui les
 * suivent : leur bail (`result_form`, qui porte nom, e-mail, téléphone,
 * adresse) et l'historique de génération (`generation.locataire_name`).
 *
 * À appeler DANS une transaction ouverte par l'appelant : c'est lui qui décide
 * de la valider ou de l'annuler. Partagée par la purge des sortis et par la
 * suppression d'un candidat, pour qu'elles ne diffèrent jamais sur ce qui part.
 */
async function supprimerFiches(
  runner: QueryRunner,
  fiches: FicheASupprimer[],
): Promise<BilanPurge> {
  if (fiches.length === 0) {
    return { locataires: 0, baux: 0, generations: 0, anciens: [] };
  }

  const locataireIds = fiches.map((f) => f.id);
  // Les ids de baux sont relevés AVANT la suppression des fiches, ensuite il
  // n'y aurait plus de quoi les retrouver.
  const bauxCandidats = [
    ...new Set(
      fiches
        .map((f) => f.result_form_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  await runner.query(`DELETE FROM "locataire" WHERE "id" = ANY($1::bigint[])`, [
    locataireIds,
  ]);

  // Un bail encore référencé par un autre locataire (colocation sur le même
  // bail) reste : il porte les données de quelqu'un qui est toujours là.
  const orphelins: { id: string }[] = await runner.query(
    `SELECT rf."id"
       FROM "result_form" rf
      WHERE rf."id" = ANY($1::bigint[])
        AND NOT EXISTS (
          SELECT 1 FROM "locataire" l WHERE l."result_form_id" = rf."id"
        )`,
    [bauxCandidats],
  );
  const bailIds = orphelins.map((b) => b.id);

  // `generation` référence `result_form` : elle part la première.
  const [, generations] = await runner.query(
    `DELETE FROM "generation" WHERE "result_form_id" = ANY($1::bigint[])`,
    [bailIds],
  );
  const [, baux] = await runner.query(
    `DELETE FROM "result_form" WHERE "id" = ANY($1::bigint[])`,
    [bailIds],
  );

  return {
    locataires: locataireIds.length,
    baux: baux as number,
    generations: generations as number,
    anciens: fiches.map(versAncien),
  };
}

/**
 * Exécute `travail` dans une transaction : validée si `executer`, annulée sinon
 * (essai à blanc, le bilan renvoyé reste exactement celui d'une vraie
 * exécution). Toute erreur annule.
 */
async function dansUneTransaction(
  dataSource: DataSource,
  executer: boolean,
  travail: (runner: QueryRunner) => Promise<BilanPurge>,
): Promise<BilanPurge> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();

  try {
    const bilan = await travail(runner);

    if (executer) {
      await runner.commitTransaction();
    } else {
      await runner.rollbackTransaction();
    }

    return bilan;
  } catch (error) {
    if (runner.isTransactionActive) {
      await runner.rollbackTransaction();
    }
    throw error;
  } finally {
    await runner.release();
  }
}

/**
 * Supprime les locataires sortis depuis plus de `DELAI_CONSERVATION_ANNEES` ans,
 * avec leurs données (voir `supprimerFiches`).
 *
 * Tout se fait dans UNE transaction : un échec au milieu ne laisse ni fiche sans
 * bail ni bail orphelin. Avec `executer: false` (essai à blanc) la transaction
 * est annulée à la fin.
 *
 * Ne touche ni aux candidats (aucune sortie : voir `supprimerCandidat`), ni aux
 * locataires en place, ni aux sortis dont la date est absente (sans date, le
 * délai ne peut pas courir), ni à ceux dont la conservation est prolongée. Ne journalise jamais de nom ni
 * d'adresse, seulement des nombres.
 *
 * Les fiches sont verrouillées (`FOR UPDATE`) : l'hébergeur peut démarrer deux
 * instances à la fois, la seconde attend la première et ne retrouve plus rien,
 * donc n'envoie pas de second rappel.
 */
export function purgerLocatairesSortis(
  dataSource: DataSource,
  { executer }: { executer: boolean },
): Promise<BilanPurge> {
  return dansUneTransaction(dataSource, executer, async (runner) => {
    const expires: FicheASupprimer[] = await runner.query(
      `SELECT ${COLONNES_FICHE}
         FROM "locataire" l
         LEFT JOIN "result_form" rf ON rf."id" = l."result_form_id"
        WHERE l."etat" = $1
          AND l."sortie" IS NOT NULL
          AND l."sortie" < CURRENT_DATE - ($2::int * INTERVAL '1 year')
          AND l."conservation_prolongee" = FALSE
          FOR UPDATE OF l`,
      [EtatLocataire.SORTI, DELAI_CONSERVATION_ANNEES],
    );

    return supprimerFiches(runner, expires);
  });
}

/**
 * Supprime un candidat (bail généré, jamais signé) avec son bail et son
 * historique de génération. Un candidat n'a pas de date de sortie : le délai de
 * conservation ne court pas pour lui, c'est le propriétaire qui décide.
 *
 * L'état est revérifié dans la transaction, sur la ligne verrouillée : une
 * signature arrivée entre-temps ne doit jamais faire disparaître un locataire.
 * Renvoie `false` si la fiche n'existe plus ou n'est plus candidate.
 */
export async function supprimerCandidat(
  dataSource: DataSource,
  id: number,
): Promise<boolean> {
  const bilan = await dansUneTransaction(dataSource, true, async (runner) => {
    const fiches: FicheASupprimer[] = await runner.query(
      `SELECT ${COLONNES_FICHE}
         FROM "locataire" l
         LEFT JOIN "result_form" rf ON rf."id" = l."result_form_id"
        WHERE l."id" = $1 AND l."etat" = $2
          FOR UPDATE OF l`,
      [id, EtatLocataire.CANDIDAT],
    );

    return supprimerFiches(runner, fiches);
  });

  return bilan.locataires > 0;
}
