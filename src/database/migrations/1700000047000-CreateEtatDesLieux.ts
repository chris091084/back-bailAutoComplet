import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Module « état des lieux numérique » : le document, ses pièces, leurs éléments,
 * les photos et le journal des modifications.
 *
 * Les identifiants sont des UUID (le lien envoyé au locataire ne doit rien
 * laisser deviner, et le client génère lui-même ceux des photos pour rejouer un
 * envoi sans doublon). Les clés vers `appartement` et `locataire` restent des
 * `bigint`, comme ces tables.
 *
 * Les valeurs d'énumération sont verrouillées par des CHECK : la base refuse un
 * état inconnu même si le code se trompe.
 */
export class CreateEtatDesLieux1700000047000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "etat_des_lieux" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "type" VARCHAR(10) NOT NULL,
        "statut" VARCHAR(10) NOT NULL DEFAULT 'draft',
        "appartement_id" BIGINT NOT NULL,
        "locataire_id" BIGINT NOT NULL,
        "etat_entree_ref_id" UUID,
        "date_creation" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "date_signature" TIMESTAMPTZ,
        "signature_bailleur" TEXT,
        "signature_locataire" TEXT,
        "adresse" VARCHAR(255) NOT NULL,
        "chauffage" VARCHAR(255),
        "cles_remises" TEXT,
        "lien_jti" UUID NOT NULL,
        "lien_expire_le" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "pk_etat_des_lieux" PRIMARY KEY ("id"),
        CONSTRAINT "ck_etat_des_lieux_type" CHECK ("type" IN ('entree', 'sortie')),
        CONSTRAINT "ck_etat_des_lieux_statut" CHECK ("statut" IN ('draft', 'validated', 'signed')),
        CONSTRAINT "fk_etat_des_lieux_appartement" FOREIGN KEY ("appartement_id") REFERENCES "appartement" ("id"),
        CONSTRAINT "fk_etat_des_lieux_locataire" FOREIGN KEY ("locataire_id") REFERENCES "locataire" ("id"),
        CONSTRAINT "fk_etat_des_lieux_entree_ref" FOREIGN KEY ("etat_entree_ref_id") REFERENCES "etat_des_lieux" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_etat_des_lieux_locataire" ON "etat_des_lieux" ("locataire_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_etat_des_lieux_appartement" ON "etat_des_lieux" ("appartement_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "edl_piece" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "etat_des_lieux_id" UUID NOT NULL,
        "nom" VARCHAR(255) NOT NULL,
        "ordre" INT NOT NULL,
        CONSTRAINT "pk_edl_piece" PRIMARY KEY ("id"),
        CONSTRAINT "fk_edl_piece_etat_des_lieux" FOREIGN KEY ("etat_des_lieux_id") REFERENCES "etat_des_lieux" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_edl_piece_etat_des_lieux" ON "edl_piece" ("etat_des_lieux_id")`,
    );

    const etats = `('NEUF', 'TRES_BON', 'BON', 'MOYEN', 'MAUVAIS')`;
    await queryRunner.query(`
      CREATE TABLE "edl_element" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "piece_id" UUID NOT NULL,
        "nom" VARCHAR(255) NOT NULL,
        "ordre" INT NOT NULL,
        "element_entree_ref_id" UUID,
        "etat_bailleur" VARCHAR(12),
        "commentaire_bailleur" TEXT,
        "etat_locataire" VARCHAR(12),
        "commentaire_locataire" TEXT,
        "date_modif_locataire" TIMESTAMPTZ,
        "statut_validation" VARCHAR(12) NOT NULL DEFAULT 'a_verifier',
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_edl_element" PRIMARY KEY ("id"),
        CONSTRAINT "ck_edl_element_etat_bailleur" CHECK ("etat_bailleur" IS NULL OR "etat_bailleur" IN ${etats}),
        CONSTRAINT "ck_edl_element_etat_locataire" CHECK ("etat_locataire" IS NULL OR "etat_locataire" IN ${etats}),
        CONSTRAINT "ck_edl_element_statut_validation" CHECK ("statut_validation" IN ('a_verifier', 'valide')),
        CONSTRAINT "fk_edl_element_piece" FOREIGN KEY ("piece_id") REFERENCES "edl_piece" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_edl_element_entree_ref" FOREIGN KEY ("element_entree_ref_id") REFERENCES "edl_element" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_edl_element_piece" ON "edl_element" ("piece_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "edl_photo" (
        "id" UUID NOT NULL,
        "element_id" UUID NOT NULL,
        "onedrive_item_id" VARCHAR(255),
        "onedrive_url" TEXT,
        "statut_sync" VARCHAR(10) NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_edl_photo" PRIMARY KEY ("id"),
        CONSTRAINT "ck_edl_photo_statut_sync" CHECK ("statut_sync" IN ('pending', 'synced')),
        CONSTRAINT "fk_edl_photo_element" FOREIGN KEY ("element_id") REFERENCES "edl_element" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_edl_photo_element" ON "edl_photo" ("element_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "edl_element_historique" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "element_id" UUID NOT NULL,
        "auteur" VARCHAR(20) NOT NULL,
        "ancienne_valeur" JSONB NOT NULL,
        "nouvelle_valeur" JSONB NOT NULL,
        "modifie_le_client" TIMESTAMPTZ,
        "cree_le" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_edl_element_historique" PRIMARY KEY ("id"),
        CONSTRAINT "ck_edl_element_historique_auteur" CHECK ("auteur" IN ('locataire', 'bailleur', 'systeme')),
        CONSTRAINT "fk_edl_element_historique_element" FOREIGN KEY ("element_id") REFERENCES "edl_element" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_edl_element_historique_element" ON "edl_element_historique" ("element_id", "cree_le")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "edl_element_historique"`);
    await queryRunner.query(`DROP TABLE "edl_photo"`);
    await queryRunner.query(`DROP TABLE "edl_element"`);
    await queryRunner.query(`DROP TABLE "edl_piece"`);
    await queryRunner.query(`DROP TABLE "etat_des_lieux"`);
  }
}
