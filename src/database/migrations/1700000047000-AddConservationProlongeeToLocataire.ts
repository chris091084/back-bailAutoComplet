import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Exception à la purge RGPD des locataires sortis : une fiche marquée
 * `conservation_prolongee` n'est jamais supprimée au bout de 3 ans, tant que le
 * propriétaire n'a pas décoché l'exception (litige en cours, titre exécutoire à
 * faire valoir, obligation de conservation plus longue…).
 *
 * Un booléen NOT NULL à faux : l'existant garde le comportement par défaut,
 * la purge s'applique.
 */
export class AddConservationProlongeeToLocataire1700000047000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        ADD COLUMN "conservation_prolongee" BOOLEAN NOT NULL DEFAULT FALSE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        DROP COLUMN "conservation_prolongee"
    `);
  }
}
