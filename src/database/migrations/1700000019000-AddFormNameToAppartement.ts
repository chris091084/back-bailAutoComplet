import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-19-set-appartement.xml */
export class AddFormNameToAppartement1700000019000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appartement" ADD COLUMN "form_name" VARCHAR(255)`,
    );

    const formNames: Array<[number, string]> = [
      [1, 'Filature 4D'],
      [2, '17B Chateau Gaillard'],
      [3, 'Rue René'],
    ];

    for (const [id, formName] of formNames) {
      await queryRunner.query(
        `UPDATE "appartement" SET "form_name" = $1 WHERE "id" = $2`,
        [formName, id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appartement" DROP COLUMN "form_name"`,
    );
  }
}
