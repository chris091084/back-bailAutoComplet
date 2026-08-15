import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fusionne `form_name` dans `name`.
 *
 * `form_name` avait été ajouté pour distinguer les logements dans le formulaire
 * de saisie de bail sans toucher à `name`, qui désignait alors un groupe de
 * biens (« Filature » pour le 4D comme pour le 3G). Deux colonnes pour une même
 * notion, dont une non unique servant malgré tout à identifier un logement dans
 * la liste des locataires. `name` reprend donc les valeurs de `form_name` et
 * devient unique.
 *
 * L'ancien `name` portait aussi trois règles de génération de bail, comparées à
 * des chaînes côté front : préfixe des fichiers d'annexe, présence d'une loggia,
 * accès au garage et aux poubelles. Elles deviennent des colonnes, remplies
 * depuis l'ancien `name` avec exactement les expressions du front — les valeurs
 * sont donc identiques à ce que le code calculait, y compris pour d'éventuelles
 * lignes ajoutées après les seeds.
 */
export class MergeFormNameIntoName1700000037000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appartement"
        ADD COLUMN "prefixe_annexe" VARCHAR(255),
        ADD COLUMN "a_loggia" BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN "a_garage_poubelle" BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // Dérivation depuis l'ancien `name`, avant qu'il ne soit écrasé :
    //   - prefixe_annexe : DocGeneratorService construisait le chemin du docx
    //     d'annexe avec name.replace(' ', '_') (Filature1.docx, Rue_René2.docx…)
    //   - a_loggia : name === 'Filature'
    //   - a_garage_poubelle : name === 'Filature' || name === 'Chateau Gaillard'
    await queryRunner.query(`
      UPDATE "appartement"
      SET "prefixe_annexe" = REPLACE("name", ' ', '_'),
          "a_loggia" = ("name" = 'Filature'),
          "a_garage_poubelle" = ("name" IN ('Filature', 'Chateau Gaillard'))
    `);

    await queryRunner.query(
      `ALTER TABLE "appartement" ALTER COLUMN "prefixe_annexe" SET NOT NULL`,
    );

    // `form_name` est nullable et sans contrainte d'unicité : on refuse de
    // continuer plutôt que de produire des noms vides ou dupliqués.
    const sansFormName: Array<{ id: string }> = await queryRunner.query(
      `SELECT "id" FROM "appartement" WHERE "form_name" IS NULL OR TRIM("form_name") = ''`,
    );

    if (sansFormName.length > 0) {
      throw new Error(
        `Migration impossible : form_name est vide pour les appartements ` +
          `${sansFormName.map((ligne) => ligne.id).join(', ')}. ` +
          `Renseignez-les avant de rejouer la migration.`,
      );
    }

    const doublons: Array<{ form_name: string }> = await queryRunner.query(
      `SELECT "form_name" FROM "appartement" GROUP BY "form_name" HAVING COUNT(*) > 1`,
    );

    if (doublons.length > 0) {
      throw new Error(
        `Migration impossible : form_name est dupliqué pour ` +
          `${doublons.map((ligne) => `« ${ligne.form_name} »`).join(', ')}. ` +
          `Le nom doit être unique.`,
      );
    }

    await queryRunner.query(`UPDATE "appartement" SET "name" = "form_name"`);

    await queryRunner.query(`
      ALTER TABLE "appartement"
        ADD CONSTRAINT "uq_appartement_name" UNIQUE ("name")
    `);

    await queryRunner.query(
      `ALTER TABLE "appartement" DROP COLUMN "form_name"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appartement" ADD COLUMN "form_name" VARCHAR(255)`,
    );

    await queryRunner.query(`UPDATE "appartement" SET "form_name" = "name"`);

    await queryRunner.query(
      `ALTER TABLE "appartement" DROP CONSTRAINT "uq_appartement_name"`,
    );

    // Le nom de groupe se reconstruit depuis le préfixe d'annexe, seul endroit
    // où il subsiste après la fusion.
    await queryRunner.query(
      `UPDATE "appartement" SET "name" = REPLACE("prefixe_annexe", '_', ' ')`,
    );

    await queryRunner.query(`
      ALTER TABLE "appartement"
        DROP COLUMN "prefixe_annexe",
        DROP COLUMN "a_loggia",
        DROP COLUMN "a_garage_poubelle"
    `);
  }
}
