import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './typeorm-options';

/**
 * Marque toutes les migrations comme déjà appliquées, sans exécuter leur SQL.
 *
 * À lancer une seule fois sur une base dont le schéma a été construit par
 * Liquibase (la production, ou une base locale existante) : les migrations
 * TypeORM rejouent le même historique, il ne faut donc surtout pas les
 * exécuter à nouveau. Sur une base vierge, utiliser `npm run migration:run`.
 */
async function baseline(): Promise<void> {
  const dataSource = new DataSource({
    ...buildTypeOrmOptions(),
    migrationsRun: false,
  });

  await dataSource.initialize();

  try {
    const schemaAlreadyBuilt = await dataSource.query(
      `SELECT to_regclass('public.appartement') IS NOT NULL AS exists`,
    );

    if (!schemaAlreadyBuilt[0]?.exists) {
      throw new Error(
        "La table 'appartement' n'existe pas : cette base est vierge. " +
          'Lancez `npm run migration:run` plutôt que le baseline.',
      );
    }

    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS "migrations" (
        "id" SERIAL NOT NULL,
        "timestamp" BIGINT NOT NULL,
        "name" VARCHAR NOT NULL,
        CONSTRAINT "pk_migrations" PRIMARY KEY ("id")
      )
    `);

    let marquees = 0;

    for (const migration of dataSource.migrations) {
      // TypeORM identifie une migration par le nom de sa classe, dont le
      // timestamp est le suffixe numérique.
      const nom = migration.constructor.name;
      const timestamp = Number(/\d+$/.exec(nom)?.[0]);

      if (Number.isNaN(timestamp)) {
        throw new Error(
          `La migration ${nom} ne se termine pas par un timestamp : impossible de la référencer.`,
        );
      }

      const [{ count }] = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM "migrations" WHERE "name" = $1`,
        [nom],
      );

      if (count > 0) {
        continue;
      }

      await dataSource.query(
        `INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)`,
        [timestamp, nom],
      );
      marquees += 1;
      console.log(`  marquée appliquée : ${nom}`);
    }

    console.log(
      marquees === 0
        ? 'Aucune migration à marquer : la base était déjà à jour.'
        : `${marquees} migration(s) marquée(s) comme appliquées.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

baseline().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
