import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-22-create-generation-table.xml */
export class CreateGeneration1700000022000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "generation" (
        "id" VARCHAR(255) NOT NULL,
        "date" TIMESTAMP NOT NULL,
        "appartement_name" VARCHAR(255) NOT NULL,
        "locataire_name" VARCHAR(255) NOT NULL,
        "result_form" TEXT,
        CONSTRAINT "pk_generation" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "generation"`);
  }
}
