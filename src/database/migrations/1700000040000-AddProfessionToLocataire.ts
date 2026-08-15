import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La profession du locataire, saisie au moment de générer le bail au même titre
 * que sa date de naissance. Nullable : les fiches créées avant n'en ont pas, et
 * rien n'oblige à la renseigner.
 */
export class AddProfessionToLocataire1700000040000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        ADD COLUMN "profession" VARCHAR(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        DROP COLUMN "profession"
    `);
  }
}
