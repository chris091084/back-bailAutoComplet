import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-21-set-chambre.xml */
export class SeedChambreAppartement41700000021000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const litDouble = "Cette chambre est équipée d'un lit double.";
    const pieces = [
      'Chambre 1 : 9.09 m²',
      'Chambre 2 : 9.18 m²',
      'Chambre 3 : 10.15 m²',
      'Chambre 4 : 10.50 m²',
    ];

    for (const piece of pieces) {
      await queryRunner.query(
        `INSERT INTO "chambre" ("piece", "caracteristique_exceptionelle", "appartement_id")
         VALUES ($1, $2, $3)`,
        [piece, litDouble, 4],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "chambre" WHERE "appartement_id" = 4`);
  }
}
