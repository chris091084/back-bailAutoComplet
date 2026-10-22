import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Prépare le chiffrement des colonnes personnelles : une valeur chiffrée
 * (`enc:v1:` + base64) est bien plus longue que la donnée d'origine, les
 * `varchar(255)` et `varchar(50)` deviennent donc `text`, et `date_naissance`, qui
 * était un `date`, devient du texte « AAAA-MM-JJ ».
 *
 * Ne chiffre RIEN : les valeurs existantes restent en clair, que l'application
 * lit sans erreur. Elles se chiffrent ensuite avec `npm run chiffrer:donnees`
 * (essai à blanc d'abord), une fois ENCRYPTION_KEY posée.
 *
 * Irréversible dès que les données sont chiffrées : le retour à `date` échouerait
 * sur du texte chiffré.
 */
export class ChiffrerColonnesPersonnelles1700000048000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        ALTER COLUMN "nom" TYPE TEXT,
        ALTER COLUMN "prenom" TYPE TEXT,
        ALTER COLUMN "telephone" TYPE TEXT,
        ALTER COLUMN "email" TYPE TEXT,
        ALTER COLUMN "profession" TYPE TEXT,
        ALTER COLUMN "date_naissance" TYPE TEXT
          USING to_char("date_naissance", 'YYYY-MM-DD')
    `);
    await queryRunner.query(`
      ALTER TABLE "result_form"
        ALTER COLUMN "email" TYPE TEXT,
        ALTER COLUMN "firstname" TYPE TEXT,
        ALTER COLUMN "name" TYPE TEXT,
        ALTER COLUMN "telephone" TYPE TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE "generation"
        ALTER COLUMN "locataire_name" TYPE TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Valide seulement tant que les colonnes sont en clair.
    await queryRunner.query(`
      ALTER TABLE "generation"
        ALTER COLUMN "locataire_name" TYPE VARCHAR(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "result_form"
        ALTER COLUMN "email" TYPE VARCHAR(255),
        ALTER COLUMN "firstname" TYPE VARCHAR(255),
        ALTER COLUMN "name" TYPE VARCHAR(255),
        ALTER COLUMN "telephone" TYPE VARCHAR(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "locataire"
        ALTER COLUMN "nom" TYPE VARCHAR(255),
        ALTER COLUMN "prenom" TYPE VARCHAR(255),
        ALTER COLUMN "telephone" TYPE VARCHAR(50),
        ALTER COLUMN "email" TYPE VARCHAR(255),
        ALTER COLUMN "profession" TYPE VARCHAR(255),
        ALTER COLUMN "date_naissance" TYPE DATE
          USING NULLIF("date_naissance", '')::date
    `);
  }
}
