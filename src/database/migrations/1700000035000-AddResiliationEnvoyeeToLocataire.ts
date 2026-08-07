import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trace l'envoi de la lettre de congé : la liste des locataires doit montrer
 * qu'un courrier est déjà parti, un mail ne se rattrapant pas.
 *
 * Une date plutôt qu'un booléen : « envoyée » sans savoir quand n'aide pas à
 * décider s'il faut relancer. Nullable, sans reprise de l'existant : les envois
 * antérieurs à cette colonne n'ont laissé aucune trace en base.
 */
export class AddResiliationEnvoyeeToLocataire1700000035000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        ADD COLUMN "resiliation_envoyee_le" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        DROP COLUMN "resiliation_envoyee_le"
    `);
  }
}
