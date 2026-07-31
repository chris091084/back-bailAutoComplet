import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-12-set-col-energieWater.xml */
export class SetEnergieWater1700000012000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "appartement" SET "energie_water" = $1 WHERE "id" IN (1, 3)`,
      ['chaudière à gaz'],
    );
    await queryRunner.query(
      `UPDATE "appartement" SET "energie_water" = $1 WHERE "id" = 2`,
      ['cumulus électrique'],
    );
  }

  public async down(): Promise<void> {
    // Mise à jour de données : non réversible utilement.
  }
}
