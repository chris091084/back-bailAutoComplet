import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-27-upd-appartement.xml (qui met à jour la table bailleur) */
export class UpdateBailleurContact1700000027000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const adress = '140 Impasse le clos du buis - 38121 Chonas-l’Amballan';

    await queryRunner.query(
      `UPDATE "bailleur"
         SET "adress" = $1, "email" = $2, "telephone" = $3
       WHERE "id" IN (3, 4)`,
      [
        adress,
        'sylvain.bodin@gmail.com / christian.coley@hotmail.fr',
        '06 13 88 31 01 / 06 50 27 92 53',
      ],
    );

    await queryRunner.query(
      `UPDATE "bailleur" SET "adress" = $1 WHERE "id" IN (1, 2)`,
      [adress],
    );
  }

  public async down(): Promise<void> {
    // Mise à jour de données : non réversible utilement.
  }
}
