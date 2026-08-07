import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-16-upd-chambre.xml (colonne + données) */
export class AddCaracteristiqueExceptionelleToChambre1700000016000 implements MigrationInterface {
  private readonly litDouble = "Cette chambre est équipée d'un lit double.";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chambre" ADD COLUMN "caracteristique_exceptionelle" VARCHAR(250)`,
    );

    const valeurs: Array<[number, string]> = [
      [3, this.litDouble],
      [4, this.litDouble],
      [
        5,
        "Cette chambre est équipée d'un lit double et a une vue sur le parc Alice et André Vansteenberghe.",
      ],
      [6, 'Cette chambre a vue sur le parc Alice et André Vansteenberghe.'],
      [7, this.litDouble],
      [
        8,
        "Cette chambre est équipée d'un lit double et a un accès direct au balcon.",
      ],
      [9, this.litDouble],
      [10, 'Cette chambre a un balcon privatif.'],
      [11, this.litDouble],
      [12, this.litDouble],
    ];

    for (const [id, caracteristique] of valeurs) {
      await queryRunner.query(
        `UPDATE "chambre" SET "caracteristique_exceptionelle" = $1 WHERE "id" = $2`,
        [caracteristique, id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chambre" DROP COLUMN "caracteristique_exceptionelle"`,
    );
  }
}
