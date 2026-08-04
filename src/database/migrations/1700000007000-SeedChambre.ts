import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-7-set-chambre.xml */
export class SeedChambre1700000007000 implements MigrationInterface {
  private readonly chambres: Array<[string, number]> = [
    ['Chambre 1 : 10.30 m²', 1],
    ['Chambre 2 : 9.14 m²', 1],
    ['Chambre 3 : 9.79 m²', 1],
    ['Chambre 4 : 11.19 m²', 1],
    ['Chambre 1 : 10.35 m²', 2],
    ['Chambre 2 : 8.68 m²', 2],
    ['Chambre 3 : 10.39 m²', 2],
    ['Chambre 4 : 10.9 m²', 2],
    ['Chambre 1 : 11.03 m²', 3],
    ['Chambre 2 : 8.07 m²', 3],
    ['Chambre 3 : 10.13 m²', 3],
    ['Chambre 4 : 10.13 m²', 3],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [piece, appartementId] of this.chambres) {
      await queryRunner.query(
        `INSERT INTO "chambre" ("piece", "appartement_id") VALUES ($1, $2)`,
        [piece, appartementId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "chambre" WHERE "appartement_id" IN (1, 2, 3)`,
    );
  }
}
