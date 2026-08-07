import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-3-chambre.xml */
export class CreateChambre1700000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chambre" (
        "id" BIGSERIAL NOT NULL,
        "piece" VARCHAR(255) NOT NULL,
        "appartement_id" BIGINT NOT NULL,
        CONSTRAINT "pk_chambre" PRIMARY KEY ("id"),
        CONSTRAINT "fk_chambre_appartement" FOREIGN KEY ("appartement_id")
          REFERENCES "appartement" ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "chambre"`);
  }
}
