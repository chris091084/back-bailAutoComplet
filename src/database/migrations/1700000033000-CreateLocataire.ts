import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Table des locataires rattachés à un appartement (plusieurs locataires pour un
 * appartement). `generation.locataire_name` reste inchangé : la reprise de
 * l'existant vers cette table n'est pas automatisée.
 */
export class CreateLocataire1700000033000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "locataire" (
        "id" BIGSERIAL NOT NULL,
        "nom" VARCHAR(255) NOT NULL,
        "prenom" VARCHAR(255) NOT NULL,
        "telephone" VARCHAR(50),
        "email" VARCHAR(255),
        "appartement_id" BIGINT NOT NULL,
        CONSTRAINT "pk_locataire" PRIMARY KEY ("id"),
        CONSTRAINT "fk_locataire_appartement" FOREIGN KEY ("appartement_id")
          REFERENCES "appartement" ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_locataire_appartement" ON "locataire" ("appartement_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "locataire"`);
  }
}
