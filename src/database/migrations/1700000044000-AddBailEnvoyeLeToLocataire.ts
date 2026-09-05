import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trace l'envoi du projet de bail au candidat, comme
 * `resiliation_envoyee_le` trace celui de la lettre de congé : la liste doit
 * montrer qu'un bail est déjà parti, un mail ne se rattrapant pas.
 *
 * Une date plutôt qu'un booléen : « envoyé » sans savoir quand n'aide pas à
 * décider s'il faut relancer. Nullable, sans reprise de l'existant : les bails
 * envoyés à la main avant cette colonne n'ont laissé aucune trace en base.
 */
export class AddBailEnvoyeLeToLocataire1700000044000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        ADD COLUMN "bail_envoye_le" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        DROP COLUMN "bail_envoye_le"
    `);
  }
}
