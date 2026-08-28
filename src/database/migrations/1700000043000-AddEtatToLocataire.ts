import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * L'état de la fiche locataire : « candidat », « locataire » ou « sorti ».
 * Générer un bail ne fait plus un occupant — la fiche naît candidate et attend
 * une signature, qui est un acte constaté et non une date de plus.
 *
 * Une colonne explicite là où `sortie` suffisait à séparer deux états : à trois,
 * la déduction demanderait une seconde date (celle de la signature) pour
 * distinguer un candidat d'un locataire, alors que c'est bien l'état, et non le
 * jour où il a changé, qui décide de l'onglet et des actions offertes.
 *
 * `etat` fait dès lors foi sur `sortie`, qui n'est plus qu'une date de détail :
 * toute transition écrit les deux, et rien ne lit plus `sortie IS NULL` pour
 * savoir où ranger la fiche.
 *
 * Le backfill ne fabrique aucun candidat : les fiches déjà en base viennent
 * toutes d'un bail effectivement signé, elles restent là où elles étaient.
 * `DEFAULT 'candidat'` ne vaut donc que pour les lignes à venir.
 */
export class AddEtatToLocataire1700000043000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        ADD COLUMN "etat" VARCHAR(20) NOT NULL DEFAULT 'candidat'
    `);

    await queryRunner.query(`
      UPDATE "locataire"
        SET "etat" = CASE WHEN "sortie" IS NOT NULL THEN 'sorti' ELSE 'locataire' END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "locataire"
        DROP COLUMN "etat"
    `);
  }
}
