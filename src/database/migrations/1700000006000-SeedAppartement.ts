import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reprise de changelog-6-set-appartement.xml.
 *
 * Les apostrophes doublées de `restrictions` ("d''animaux") sont conservées
 * telles quelles : Liquibase insérait ces valeurs via des requêtes préparées,
 * elles sont donc bien stockées doublées en base. Les corriger ici ferait
 * diverger une base recréée de zéro de la base de production.
 */
export class SeedAppartement1700000006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const restrictionsFilature =
      "La détention d''animaux domestiques n''est pas autorisée par le bailleur. Cette interdiction résulte du règlement de copropriété de la résidence. Ce règlement est joint en annexe.";
    const restrictionsSimple =
      "La détention d''animaux domestiques n''est pas autorisée par le bailleur.";

    await queryRunner.query(
      `INSERT INTO "appartement" (
         "name", "bailleur_id", "adress", "type_chauffage", "chauffage_collectif",
         "bank_name", "restrictions", "construction_period", "surface", "charges",
         "loyers", "caution"
       ) VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12),
         ($13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24),
         ($25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36)`,
      [
        // Filature
        'Filature',
        1,
        '56 rue de la Filature - 69100 VILLEURBANNE',
        'chaudière à gaz',
        true,
        'Etablissement bancaire : Crédit Mutuel de Bretagne – Louvigné du Désert<br/>IBAN : FR76 1558 9351 5600 3177 7744 286<br/>Code BIC : CMBRFR2BXXX',
        restrictionsFilature,
        '1968',
        81.18,
        209.04,
        251.66,
        1000,
        // Chateau Gaillard
        'Chateau Gaillard',
        2,
        '17 bis rue Château Gaillard',
        'cumulus électrique',
        true,
        'Etablissement bancaire : Crédit Mutuel de Bretagne – Louvigné du Désert<br/>IBAN : FR76 1558 9351 5600 3177 7744 383<br/>Code BIC : CMBRFR2BXXX',
        restrictionsSimple,
        '1946-1970',
        73.78,
        189.98,
        228.72,
        3000,
        // Rue René
        'Rue René',
        1,
        '1 rue René',
        'chaudière à gaz',
        false,
        'Etablissement bancaire : Crédit Agricole Ille et Vilaine – Maen Roch<br/>IBAN : FR76 1360 6000 3346 3385 5675 616<br/>Code BIC : AGRIFRPP83',
        restrictionsSimple,
        '1946-1970',
        72.83,
        187.54,
        225.77,
        1000,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "appartement" WHERE "id" IN (1, 2, 3)`,
    );
  }
}
