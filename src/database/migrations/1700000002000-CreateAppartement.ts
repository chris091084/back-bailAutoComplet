import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-2-appartement.xml */
export class CreateAppartement1700000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "appartement" (
        "id" BIGSERIAL NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "bailleur_id" BIGINT NOT NULL,
        "adress" VARCHAR(255) NOT NULL,
        "type_chauffage" VARCHAR(100) NOT NULL,
        "chauffage_collectif" BOOLEAN NOT NULL,
        "bank_name" TEXT,
        "restrictions" TEXT,
        "construction_period" VARCHAR(50),
        "surface" DECIMAL(10,2),
        "charges" DECIMAL(10,2),
        "loyers" DECIMAL(10,2),
        "caution" DECIMAL(10,2),
        CONSTRAINT "pk_appartement" PRIMARY KEY ("id"),
        CONSTRAINT "fk_appartement_bailleur" FOREIGN KEY ("bailleur_id")
          REFERENCES "bailleur" ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "appartement"`);
  }
}
