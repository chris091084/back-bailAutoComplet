import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-18-set-bailleur.xml (bailleurs 3 et 4) */
export class SeedBailleurSci1700000018000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "bailleur" ("name", "adress", "email", "telephone")
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
      [
        "SSCI BREIZHSTOCK, Société civile immobilière au capital de 1000 €, dont le siège est à CHONAS-L'AMBALLAN (38121), 140 impasse le Clos du Buis, identifiée au SIREN sous le numéro 991506817 et immatriculée au Registre du Commerce et des Sociétés de VIENNE.",
        '140 impasse le Clos du Buis  -  38121 CHONAS l’AMBALLAN',
        'sylvain.bodin@gmail.com',
        '06 13 88 31 01',
        "SCI BZHRO, Société civile immobilière au capital de 1000 €, dont le siège est à CHONAS-L'AMBALLAN (38121), 140 impasse le Clos du Buis, identifiée au SIREN sous le numéro 993376151 et immatriculée au Registre du Commerce et des Sociétés de VIENNE",
        '140 impasse le Clos du Buis  -  38121 CHONAS l’AMBALLAN',
        'christian.coley@hotmail.fr',
        '06 50 27 92 53',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "bailleur" WHERE "id" IN (3, 4)`);
  }
}
