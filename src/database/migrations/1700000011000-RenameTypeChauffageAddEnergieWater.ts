import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-11-upd-rename-colonne-and-add-colonne.xml */
export class RenameTypeChauffageAddEnergieWater1700000011000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appartement" RENAME COLUMN "type_chauffage" TO "energie_heating"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appartement" ALTER COLUMN "energie_heating" TYPE VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "appartement" ADD COLUMN "energie_water" VARCHAR(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appartement" DROP COLUMN "energie_water"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appartement" ALTER COLUMN "energie_heating" TYPE VARCHAR(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "appartement" RENAME COLUMN "energie_heating" TO "type_chauffage"`,
    );
  }
}
