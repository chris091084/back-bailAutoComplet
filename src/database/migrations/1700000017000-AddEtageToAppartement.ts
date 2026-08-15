import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-17-set-col-etage.xml */
export class AddEtageToAppartement1700000017000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appartement" ADD COLUMN "etage" VARCHAR(255)`,
    );
    await queryRunner.query(
      `UPDATE "appartement" SET "etage" = $1 WHERE "id" IN (1, 2, 3)`,
      ['4ème étage, porte de droite.'],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "appartement" DROP COLUMN "etage"`);
  }
}
