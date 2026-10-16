import 'dotenv/config';
import { Client } from 'pg';

/**
 * Base dédiée aux tests e2e, recréée à neuf à chaque lancement : les migrations
 * la remplissent depuis zéro, ce qui vérifie au passage qu'elles s'enchaînent.
 *
 * Elle vit sur le même serveur Postgres que le développement (variables DB_*),
 * mais sous un autre NOM : la base de développement n'est jamais touchée.
 */
export const E2E_DB_NAME = process.env.E2E_DB_NAME ?? 'bailautocomplet_e2e';

/**
 * Nom de la base de développement, relevé AU CHARGEMENT de ce module : le test
 * réécrit ensuite `DB_NAME` pour pointer l'application vers la base e2e, et la
 * comparaison de sécurité doit se faire avec la valeur d'origine.
 */
const BASE_DEVELOPPEMENT = process.env.DB_NAME;

export async function recreerBaseE2e(): Promise<void> {
  if (E2E_DB_NAME === BASE_DEVELOPPEMENT) {
    throw new Error(
      `E2E_DB_NAME (${E2E_DB_NAME}) est la base de développement : refus de l'effacer.`,
    );
  }

  const admin = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'root',
    database: 'postgres',
  });

  try {
    await admin.connect();
  } catch (error) {
    throw new Error(
      'Postgres injoignable pour les tests e2e (variables DB_HOST, DB_PORT…). ' +
        'Démarrez la base : docker start bailautocomplete-front-db-1. ' +
        `Détail : ${(error as Error).message}`,
    );
  }

  try {
    await admin.query(`DROP DATABASE IF EXISTS "${E2E_DB_NAME}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${E2E_DB_NAME}"`);
  } finally {
    await admin.end();
  }
}
