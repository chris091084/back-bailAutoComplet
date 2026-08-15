import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reprise de changelog-23-create-result-form-table.xml */
export class CreateResultForm1700000023000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "result_form" (
        "id" BIGSERIAL NOT NULL,
        "adress" TEXT,
        "appartement_id" BIGINT,
        "charge_price" DECIMAL(19,2),
        "email" VARCHAR(255),
        "firstname" VARCHAR(255),
        "date_from" DATE,
        "date_to" DATE,
        "motif" TEXT,
        "name" VARCHAR(255),
        "price_no_charge" DECIMAL(19,2),
        "room" VARCHAR(255),
        "telephone" VARCHAR(255),
        "bailleur_id" BIGINT,
        "bail_type" VARCHAR(255),
        "t_irl" VARCHAR(255),
        "val_irl" VARCHAR(255),
        "last_price_without_charge" DECIMAL(19,2),
        "charge_list" BOOLEAN,
        "clause_less_6_month" BOOLEAN,
        "type_residence" VARCHAR(255),
        "rent_ref" DECIMAL(19,2),
        "rent_ref_maj" DECIMAL(19,2),
        CONSTRAINT "pk_result_form" PRIMARY KEY ("id"),
        CONSTRAINT "fk_result_form_appartement" FOREIGN KEY ("appartement_id")
          REFERENCES "appartement" ("id"),
        CONSTRAINT "fk_result_form_bailleur" FOREIGN KEY ("bailleur_id")
          REFERENCES "bailleur" ("id")
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "generation" DROP COLUMN "result_form"`,
    );
    await queryRunner.query(`
      ALTER TABLE "generation"
        ADD COLUMN "result_form_id" BIGINT,
        ADD CONSTRAINT "fk_generation_result_form" FOREIGN KEY ("result_form_id")
          REFERENCES "result_form" ("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generation"
        DROP CONSTRAINT "fk_generation_result_form",
        DROP COLUMN "result_form_id",
        ADD COLUMN "result_form" TEXT
    `);
    await queryRunner.query(`DROP TABLE "result_form"`);
  }
}
