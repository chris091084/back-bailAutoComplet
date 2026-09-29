import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lien magique de connexion par email : seule l'empreinte SHA-256 du jeton est
 * stockée, avec sa date d'expiration. Une seule colonne de chaque suffit, le
 * compte étant unique : demander un nouveau lien invalide le précédent.
 */
export class AddMagicLinkToAuthAccount1700000045000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "auth_account"
        ADD COLUMN "magic_link_hash" VARCHAR(64),
        ADD COLUMN "magic_link_expires_at" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "auth_account"
        DROP COLUMN "magic_link_expires_at",
        DROP COLUMN "magic_link_hash"
    `);
  }
}
