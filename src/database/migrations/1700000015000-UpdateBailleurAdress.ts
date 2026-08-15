import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-15-upd-bailleur.xml */
export class UpdateBailleurAdress1700000015000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "bailleur" SET "adress" = $1 WHERE "id" IN (1, 2)`,
      ['140 impasse le clos du buis  -  38121 Chonas-l’Amballan'],
    );
  }

  public async down(): Promise<void> {
    // Mise à jour de données : non réversible utilement.
  }
}
