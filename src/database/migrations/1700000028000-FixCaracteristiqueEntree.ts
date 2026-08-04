import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reprise de changelog-28-upd-caracteristique.xml : corrige « Enrée » en
 * « Entrée » sur la première caractéristique des appartements 4 et 5.
 *
 * Le changelog d'origine ciblait les ids 23 et 30 en dur. On cible ici la même
 * ligne par son contenu, ce qui donne le même résultat sur la base de
 * production et reste correct sur une base recréée de zéro même si les
 * séquences ont dérivé.
 */
export class FixCaracteristiqueEntree1700000028000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "caracteristique"
         SET "description" = 'Entrée'
       WHERE "description" = 'Enrée' AND "appartement_id" IN (4, 5)`,
    );
  }

  public async down(): Promise<void> {
    // Correction de données : non réversible utilement.
  }
}
