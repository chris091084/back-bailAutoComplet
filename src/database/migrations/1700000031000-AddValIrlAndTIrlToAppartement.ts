import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sans équivalent Liquibase.
 *
 * Les colonnes `val_irl` et `t_irl` de la table appartement n'apparaissent dans
 * aucun changelog : elles ont été créées silencieusement par Hibernate via
 * `spring.jpa.hibernate.ddl-auto=update`. Elles existent donc en production
 * mais manqueraient à une base recréée uniquement à partir des changelogs.
 *
 * La migration est écrite en IF NOT EXISTS pour rester rejouable sur une base
 * où Hibernate les a déjà créées.
 */
export class AddValIrlAndTIrlToAppartement1700000031000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appartement"
        ADD COLUMN IF NOT EXISTS "val_irl" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "t_irl" VARCHAR(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appartement"
        DROP COLUMN IF EXISTS "t_irl",
        DROP COLUMN IF EXISTS "val_irl"
    `);
  }
}
