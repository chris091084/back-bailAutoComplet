import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Date de sortie du locataire : un départ ne s'efface pas, il se date. La
 * suppression pure et simple faisait perdre le bail, les quittances émises et
 * l'historique des courriers, alors qu'un locataire parti reste une pièce du
 * dossier de l'appartement.
 *
 * Une `date` et non un `timestamptz` comme `resiliation_envoyee_le` : c'est un
 * jour de calendrier saisi à la main, pas un instant constaté par le serveur.
 * Nullable, `NULL` valant « toujours en place ».
 */
export class AddSortieToLocataire1700000036000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        ADD COLUMN "sortie" DATE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        DROP COLUMN "sortie"
    `);
  }
}
