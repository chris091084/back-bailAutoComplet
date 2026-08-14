import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-8-set-caracteristique.xml (appartements 1, 2 et 3) */
export class SeedCaracteristique1700000008000 implements MigrationInterface {
  private readonly caracteristiques: Array<[string, number]> = [
    ["L'entrée du logement et son couloir (8.20m²)", 1],
    ['La cuisine entièrement équipée (9,53m²)', 1],
    ['Le salon (17.58m²)', 1],
    ['Le WC (1.04m²)', 1],
    ['La salle de bains (4.41m²)', 1],
    ['Une loggia (1.99m²)', 1],
    ['Un balcon (4,30m²)', 1],
    ['Des placards accessibles depuis le couloir.', 1],
    ["L'entrée du logement (3.68m²)", 2],
    ['La cuisine entièrement équipée (6.45m²)', 2],
    ['Le salon (21 m²)', 2],
    ['Le WC (0.90m²)', 2],
    ['La salle de bains (3.22m²)', 2],
    ['Un balcon (5,09m²)', 2],
    ['Des placards accessibles depuis le salon.', 2],
    ["L'entrée du logement (5,08m²)", 3],
    ['La cuisine entièrement équipée (6,41m²)', 3],
    ['Le salon (17,14m²)', 3],
    ['Le WC (0,96m²)', 3],
    ['La salle de bains (2,53m²)', 3],
    ['Un dégagement (1.35m²)', 3],
    ['Un balcon (3,52m²)', 3],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [description, appartementId] of this.caracteristiques) {
      await queryRunner.query(
        `INSERT INTO "caracteristique" ("description", "appartement_id") VALUES ($1, $2)`,
        [description, appartementId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "caracteristique" WHERE "appartement_id" IN (1, 2, 3)`,
    );
  }
}
