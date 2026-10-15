import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Échecs de connexion par mot de passe, une ligne par tentative ratée.
 *
 * Le compteur vivait en mémoire : remis à zéro à chaque redémarrage et propre à
 * chaque instance, il ne limitait rien dès que l'hébergeur lance plusieurs
 * conteneurs. En base, tous partagent le même.
 *
 * `TIMESTAMPTZ` plutôt que `TIMESTAMP` : les fenêtres de temps sont calculées en
 * SQL avec NOW(), sans dépendre du fuseau du process Node.
 */
export class CreateLoginFailure1700000046000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "login_failure" (
        "id" SERIAL NOT NULL,
        "ip" VARCHAR(64) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_login_failure" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_login_failure_ip_created_at" ON "login_failure" ("ip", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_login_failure_created_at" ON "login_failure" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "login_failure"`);
  }
}
