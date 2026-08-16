import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Couleurs CSS des chambres, cohérentes par numéro de chambre sur l'ensemble
 * des appartements :
 *   Chambre 1 → #80EF80 (vert)
 *   Chambre 2 → #FFEE8C (jaune)
 *   Chambre 3 → #B3EBF2 (bleu)
 *   Chambre 4 → #F68A74 (rouge/saumon)
 */
export class SeedCouleurChambre1700000042000 implements MigrationInterface {
  private readonly couleurs: Array<[number, string]> = [
    [1, '#80EF80'],
    [2, '#FFEE8C'],
    [3, '#B3EBF2'],
    [4, '#F68A74'],
    [5, '#80EF80'],
    [6, '#FFEE8C'],
    [7, '#B3EBF2'],
    [8, '#F68A74'],
    [9, '#80EF80'],
    [10, '#FFEE8C'],
    [11, '#B3EBF2'],
    [12, '#F68A74'],
    [13, '#80EF80'],
    [14, '#FFEE8C'],
    [15, '#B3EBF2'],
    [16, '#F68A74'],
    [17, '#80EF80'],
    [18, '#FFEE8C'],
    [19, '#B3EBF2'],
    [20, '#F68A74'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [id, couleur] of this.couleurs) {
      await queryRunner.query(
        `UPDATE "chambre" SET "couleur" = $1 WHERE "id" = $2`,
        [couleur, id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "chambre" SET "couleur" = NULL WHERE "id" BETWEEN 1 AND 20`,
    );
  }
}
