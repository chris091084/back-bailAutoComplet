import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-10-set-petRule-in-appartement.xml */
export class SetPetRule1700000010000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "appartement" SET "pet_rule" = $1 WHERE "id" = 1`,
      [
        "La détention d'animaux domestiques n'est pas autorisée par le bailleur. Cette interdiction résulte du règlement de copropriété de la résidence. Ce règlement est joint en annexe.",
      ],
    );
    await queryRunner.query(
      `UPDATE "appartement" SET "pet_rule" = $1 WHERE "id" IN (2, 3)`,
      [
        "La détention d'animaux domestiques n'est pas autorisée par le bailleur.",
      ],
    );
  }

  public async down(): Promise<void> {
    // Mise à jour de données : l'état antérieur (colonne vide) n'a pas d'intérêt
    // à être restauré.
  }
}
