import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reprise de changelog-13-upd-col-appartement.xml.
 *
 * Ce changelog réapplique à l'identique les valeurs déjà posées par
 * changelog-10 : il est conservé pour garder la correspondance 1:1 avec
 * l'historique Liquibase, mais il ne change rien à l'état de la base.
 */
export class UpdatePetRule1700000013000 implements MigrationInterface {
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
    // Mise à jour de données : non réversible utilement.
  }
}
