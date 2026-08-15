import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `annee_naissance` devient `date_naissance` : l'année seule datait l'âge à
 * douze mois près, la date complète le donne juste et se saisit d'un
 * calendrier plutôt que d'un nombre à quatre chiffres.
 *
 * Les années déjà saisies sont converties au 1er janvier, faute de mieux : le
 * jour est perdu (il n'a jamais été stocké), l'année est conservée, et l'âge
 * affiché reste celui d'avant à un anniversaire près. Le `down` reprend
 * l'année, seule information que la colonne d'origine portait.
 */
export class ReplaceAnneeNaissanceByDateNaissance1700000039000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        ALTER COLUMN "annee_naissance" TYPE DATE
        USING make_date("annee_naissance", 1, 1)
    `);

    await queryRunner.query(`
      ALTER TABLE "locataire"
        RENAME COLUMN "annee_naissance" TO "date_naissance"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        RENAME COLUMN "date_naissance" TO "annee_naissance"
    `);

    await queryRunner.query(`
      ALTER TABLE "locataire"
        ALTER COLUMN "annee_naissance" TYPE INT
        USING EXTRACT(YEAR FROM "annee_naissance")::INT
    `);
  }
}
