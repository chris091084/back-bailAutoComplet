import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Deux colonnes de la fiche locataire :
 *
 * - `annee_naissance`, dont la liste tire l'âge affiché. L'année seule et non la
 *   date complète : le bail ne demande pas le jour de naissance, et l'âge à
 *   l'année suffit à ce qu'on en fait.
 * - `entree`, la date d'entrée dans le logement. Elle vient de
 *   `result_form.date_from` — la date de prise d'effet du bail signé — mais est
 *   recopiée sur le locataire plutôt que lue à travers la liaison : une entrée
 *   se corrige (bail refait, emménagement décalé) sans qu'on touche au bail
 *   généré, et une fiche détachée de son result_form garde sa date.
 *
 * L'existant est repris depuis le bail rattaché, seule source disponible.
 */
export class AddAnneeNaissanceAndEntreeToLocataire1700000038000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        ADD COLUMN "annee_naissance" INT,
        ADD COLUMN "entree" DATE
    `);

    await queryRunner.query(`
      UPDATE "locataire" AS l
      SET "entree" = r."date_from"
      FROM "result_form" AS r
      WHERE l."result_form_id" = r."id"
        AND r."date_from" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        DROP COLUMN "annee_naissance",
        DROP COLUMN "entree"
    `);
  }
} 
