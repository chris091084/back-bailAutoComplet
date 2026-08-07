import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reprise de changelog-20-upd-appartement.xml (appartements 4 et 5).
 *
 * Le `bank_name` de l'appartement 5 était commenté dans le changelog d'origine
 * (TODO laissé par l'auteur) : il reste donc NULL ici. Il est renseigné pour
 * l'appartement 4 par la migration suivante (reprise de changelog-24).
 */
export class SeedAppartement4And51700000020000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const restrictionsFilature =
      "La détention d''animaux domestiques n''est pas autorisée par le bailleur. Cette interdiction résulte du règlement de copropriété de la résidence. Ce règlement est joint en annexe.";

    await queryRunner.query(
      `INSERT INTO "appartement" (
         "form_name", "name", "bailleur_id", "adress", "energie_heating",
         "chauffage_collectif", "bank_name", "restrictions",
         "construction_period", "surface", "etage"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        'Filature 3G',
        'Filature',
        3,
        '56 rue de la Filature - 69100 VILLEURBANNE',
        'chaudière à gaz',
        true,
        'Etablissement bancaire : Crédit Mutuel de Bretagne – Louvigné du Désert<br/>IBAN : FR76 1558 9351 5600 1451 6244 019<br/>Code BIC : CMBRFR2BARK',
        restrictionsFilature,
        '1968',
        80.83,
        '3ème étage, porte de gauche.',
      ],
    );

    await queryRunner.query(
      `INSERT INTO "appartement" (
         "form_name", "name", "bailleur_id", "adress", "energie_heating",
         "chauffage_collectif", "construction_period", "surface", "etage"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        '53A Chateau Gaillard',
        'Chateau Gaillard',
        4,
        '53A bis rue Château Gaillard',
        'chaudière à gaz',
        false,
        '1959',
        80.53,
        '3ème étage, porte de gauche.',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "appartement" WHERE "id" IN (4, 5)`);
  }
}
