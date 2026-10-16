import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Connexion OneDrive du bailleur : une seule ligne (`id = 1`), qui garde le
 * refresh token CHIFFRÉ. Le CHECK interdit une deuxième ligne : l'application
 * n'a qu'un OneDrive.
 */
export class CreateOnedriveConnexion1700000048000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "onedrive_connexion" (
        "id" INT NOT NULL,
        "refresh_token_chiffre" TEXT NOT NULL,
        "statut" VARCHAR(10) NOT NULL DEFAULT 'connecte',
        "connecte_le" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_onedrive_connexion" PRIMARY KEY ("id"),
        CONSTRAINT "ck_onedrive_connexion_unique" CHECK ("id" = 1),
        CONSTRAINT "ck_onedrive_connexion_statut" CHECK ("statut" IN ('connecte', 'revoque'))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "onedrive_connexion"`);
  }
}
