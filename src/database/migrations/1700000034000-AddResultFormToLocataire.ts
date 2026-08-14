import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rattache un locataire au result_form dont il est issu, pour retrouver la date
 * de signature du bail (`result_form.date_from`) au moment de générer sa lettre
 * de congé.
 *
 * Nullable et sans reprise de l'existant : les locataires déjà saisis n'ont pas
 * de result_form identifiable de façon fiable (aucune clé commune, seulement des
 * noms), le champ se remplira à la ressaisie.
 */
export class AddResultFormToLocataire1700000034000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        ADD COLUMN "result_form_id" BIGINT,
        ADD CONSTRAINT "fk_locataire_result_form" FOREIGN KEY ("result_form_id")
          REFERENCES "result_form" ("id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_locataire_result_form" ON "locataire" ("result_form_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_locataire_result_form"`);
    await queryRunner.query(`
      ALTER TABLE "locataire"
        DROP CONSTRAINT "fk_locataire_result_form",
        DROP COLUMN "result_form_id"
    `);
  }
}
