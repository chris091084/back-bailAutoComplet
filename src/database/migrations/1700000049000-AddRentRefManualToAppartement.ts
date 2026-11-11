import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pendant de `irl_manual` pour les loyers de référence : tant que la colonne
 * vaut FALSE, `rent_ref` et `rent_ref_maj` sont remplis automatiquement depuis
 * l'encadrement des loyers de la Métropole de Lyon.
 */
export class AddRentRefManualToAppartement1700000049000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appartement"
         ADD COLUMN "rent_ref_manual" BOOLEAN NOT NULL DEFAULT FALSE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appartement" DROP COLUMN "rent_ref_manual"`,
    );
  }
}
