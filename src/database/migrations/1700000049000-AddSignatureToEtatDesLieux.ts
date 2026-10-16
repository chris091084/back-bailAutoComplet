import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Traces de la signature : l'empreinte (SHA-256) du contenu au moment de signer,
 * et où en est l'envoi du PDF. L'empreinte permet de prouver, en cas de litige,
 * que le document n'a pas bougé depuis la signature.
 */
export class AddSignatureToEtatDesLieux1700000049000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "etat_des_lieux"
        ADD COLUMN "empreinte" VARCHAR(64),
        ADD COLUMN "pdf_envoye_le" TIMESTAMPTZ,
        ADD COLUMN "pdf_onedrive_item_id" VARCHAR(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "etat_des_lieux"
        DROP COLUMN "empreinte",
        DROP COLUMN "pdf_envoye_le",
        DROP COLUMN "pdf_onedrive_item_id"
    `);
  }
}
