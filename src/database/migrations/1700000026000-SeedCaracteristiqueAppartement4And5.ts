import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reprise de changelog-26-set-caracteristique.xml.
 *
 * L'ordre est celui du fichier d'origine (changeSet « 26-2 » pour
 * l'appartement 4 avant « 26-1 » pour l'appartement 5) : il détermine les ids
 * attribués, que la migration suivante (reprise de changelog-28) cible
 * explicitement.
 *
 * La faute de frappe « Enrée » est reproduite telle quelle, puis corrigée par
 * cette même migration suivante — comme dans l'historique Liquibase.
 */
export class SeedCaracteristiqueAppartement4And51700000026000 implements MigrationInterface {
  private readonly caracteristiques: Array<[string, number]> = [
    ['Enrée', 4],
    ['Cuisine', 4],
    ['Salon', 4],
    ['WC', 4],
    ['Salle de bains', 4],
    ['Logia', 4],
    ['Balcon', 4],
    ['Enrée', 5],
    ['Cuisine', 5],
    ['Salon', 5],
    ['WC', 5],
    ['Salle de bains', 5],
    ['Balcon', 5],
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
      `DELETE FROM "caracteristique" WHERE "appartement_id" IN (4, 5)`,
    );
  }
}
