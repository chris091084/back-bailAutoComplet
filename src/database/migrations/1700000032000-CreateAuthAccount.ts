import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * L'unique compte de l'application.
 *
 * La table est créée avec sa ligne, et une contrainte interdit toute autre clé :
 * il n'y a qu'un compte, donc au plus une session.
 *
 * `password_hash` part à NULL volontairement : aucun mot de passe par défaut ne
 * doit exister, sans quoi un déploiement fraîchement migré serait ouvert avec un
 * identifiant connu d'avance. Le mot de passe est semé hors ligne par
 * `npm run auth:seed` ; aucune route HTTP ne permet de l'écrire.
 */
export class CreateAuthAccount1700000032000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_account" (
        "id" INTEGER NOT NULL,
        "password_hash" VARCHAR(255),
        "refresh_token_hash" VARCHAR(255),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_auth_account" PRIMARY KEY ("id"),
        CONSTRAINT "ck_auth_account_singleton" CHECK ("id" = 1)
      )
    `);

    await queryRunner.query(
      `INSERT INTO "auth_account" ("id", "password_hash", "refresh_token_hash")
       VALUES (1, NULL, NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "auth_account"`);
  }
}
