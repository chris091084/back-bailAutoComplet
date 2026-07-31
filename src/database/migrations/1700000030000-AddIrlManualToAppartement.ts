import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reprise de changelog-30-add-irl-manual-appartement.xml.
 *
 * (changelog-29 n'a volontairement pas d'équivalent : il n'était pas inclus
 * dans db.changelog-master.xml et n'a donc jamais été appliqué. Il ciblait de
 * toute façon une colonne `adress` inexistante sur la table caracteristique.)
 */
export class AddIrlManualToAppartement1700000030000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appartement"
         ADD COLUMN "irl_manual" BOOLEAN NOT NULL DEFAULT FALSE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appartement" DROP COLUMN "irl_manual"`,
    );
  }
}
