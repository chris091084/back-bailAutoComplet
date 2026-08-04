import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-24-upd-appartement.xml */
export class UpdateAppartement4And51700000024000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "appartement" SET "bank_name" = $1, "energie_water" = $2 WHERE "id" = 4`,
      [
        'Etablissement bancaire : Crédit Mutuel de Bretagne – Louvigné du Désert<br/>IBAN : FR76 1558 9351 5600 1451 6244 019<br/>Code BIC : CMBRFR2BARK<br/>NOM: BREIZHSTOCK',
        'chaudière à gaz',
      ],
    );
    await queryRunner.query(
      `UPDATE "appartement" SET "energie_water" = $1 WHERE "id" = 5`,
      ['chaudière à gaz'],
    );
  }

  public async down(): Promise<void> {
    // Mise à jour de données : non réversible utilement.
  }
}
