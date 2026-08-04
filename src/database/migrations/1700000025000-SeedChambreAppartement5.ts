import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-25-set-chambre.xml */
export class SeedChambreAppartement51700000025000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const litDouble = "Cette chambre est équipée d'un lit double.";
    const pieces = [
      'Chambre 1 : 10.08 m²',
      'Chambre 2 : 11.74 m²',
      'Chambre 3 : 14.15 m²',
      'Chambre 4 : 11.57 m²',
    ];

    for (const piece of pieces) {
      await queryRunner.query(
        `INSERT INTO "chambre" ("piece", "caracteristique_exceptionelle", "appartement_id")
         VALUES ($1, $2, $3)`,
        [piece, litDouble, 5],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "chambre" WHERE "appartement_id" = 5`);
  }
}
