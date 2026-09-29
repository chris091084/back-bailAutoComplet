import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Passkeys (WebAuthn) de l'unique compte.
 *
 * Seule la clé publique est stockée : la clé privée ne quitte jamais
 * l'authentificateur de l'utilisateur. Une fuite de cette table ne permet donc
 * pas de se connecter.
 */
export class CreatePasskeyCredential1700000044000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "passkey_credential" (
        "id" SERIAL NOT NULL,
        "credential_id" VARCHAR(512) NOT NULL,
        "public_key" BYTEA NOT NULL,
        "counter" BIGINT NOT NULL DEFAULT 0,
        "transports" VARCHAR(255),
        "label" VARCHAR(100) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "last_used_at" TIMESTAMP,
        CONSTRAINT "pk_passkey_credential" PRIMARY KEY ("id"),
        CONSTRAINT "uq_passkey_credential_credential_id" UNIQUE ("credential_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "passkey_credential"`);
  }
}
