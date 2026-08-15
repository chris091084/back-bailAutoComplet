import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-14-set-rentRef-rentRefMaj-in-appartement.xml */
export class SetRentRefValues1700000014000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "appartement" SET "rent_ref" = $1, "rent_ref_maj" = $2 WHERE "id" = 1`,
      [10.7, 12.8],
    );
    await queryRunner.query(
      `UPDATE "appartement" SET "rent_ref" = $1, "rent_ref_maj" = $2 WHERE "id" IN (2, 3)`,
      [11.3, 13.6],
    );
  }

  public async down(): Promise<void> {
    // Mise à jour de données : non réversible utilement.
  }
}
