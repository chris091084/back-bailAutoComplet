import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-1-bailleur.xml */
export class CreateBailleur1700000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bailleur" (
        "id" BIGSERIAL NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "adress" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL,
        "telephone" VARCHAR(50) NOT NULL,
        CONSTRAINT "pk_bailleur" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bailleur"`);
  }
}
