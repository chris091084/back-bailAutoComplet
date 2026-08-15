import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-4-caracteristique.xml */
export class CreateCaracteristique1700000004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "caracteristique" (
        "id" BIGSERIAL NOT NULL,
        "description" TEXT NOT NULL,
        "appartement_id" BIGINT NOT NULL,
        CONSTRAINT "pk_caracteristique" PRIMARY KEY ("id"),
        CONSTRAINT "fk_caracteristique_appartement" FOREIGN KEY ("appartement_id")
          REFERENCES "appartement" ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "caracteristique"`);
  }
}
