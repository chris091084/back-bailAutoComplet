import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-9-upd-appartement.xml */
export class AddRentRefAndPetRuleToAppartement1700000009000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appartement"
        ADD COLUMN "rent_ref" DECIMAL(10,2),
        ADD COLUMN "rent_ref_maj" DECIMAL(10,2),
        ADD COLUMN "pet_rule" VARCHAR(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appartement"
        DROP COLUMN "pet_rule",
        DROP COLUMN "rent_ref_maj",
        DROP COLUMN "rent_ref"
    `);
  }
}
