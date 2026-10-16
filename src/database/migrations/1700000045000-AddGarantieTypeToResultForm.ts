import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Type de garantie du bail (« Visale », « Garant physique »), saisi au
 * formulaire de génération et repris dans le mail d'envoi du projet de bail
 * (Annexe 2 : engagement de cautionnement). Nullable : les baux déjà générés
 * n'ont pas cette information.
 */
export class AddGarantieTypeToResultForm1700000045000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "result_form"
        ADD COLUMN "garantie_type" VARCHAR(50)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "result_form"
        DROP COLUMN "garantie_type"
    `);
  }
}
