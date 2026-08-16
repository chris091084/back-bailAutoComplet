import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCouleurToChambre1700000041000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chambre" ADD COLUMN "couleur" VARCHAR(7)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chambre" DROP COLUMN "couleur"`);
  }
}
