import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-5-set-bailleur.xml */
export class SeedBailleur1700000005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "bailleur" ("name", "adress", "email", "telephone")
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
      [
        'M. BODIN Sylvain',
        '118 chemin du Bassard  -  38121 CHONAS l’AMBALLAN',
        'sylvain.bodin@gmail.com',
        '06 13 88 31 01',
        'M. BODIN Sylvain et M. COLEY Christian',
        '118 chemin du Bassard  -  38121 CHONAS l’AMBALLAN',
        'sylvain.bodin@gmail.com / christian.coley@hotmail.fr',
        '06 13 88 31 01 / 06 50 27 92 53',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "bailleur" WHERE "id" IN (1, 2)`);
  }
}
