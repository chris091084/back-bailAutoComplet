import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Bailleur } from '../bailleur/bailleur.entity';
import { Caracteristique } from '../caracteristique/caracteristique.entity';
import { Chambre } from '../chambre/chambre.entity';
import { numericTransformer } from '../common/numeric.transformer';

@Entity('appartement')
export class Appartement {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: numericTransformer,
  })
  id!: number;

  /** Nom unique du logement : « Filature 4D », « 17B Chateau Gaillard »… */
  @Column({ type: 'varchar', length: 255, unique: true })
  name!: string;

  @ManyToOne(() => Bailleur, { eager: true })
  @JoinColumn({ name: 'bailleur_id' })
  bailleur!: Bailleur;

  @Column({ type: 'varchar', length: 255 })
  adress!: string;

  // L'ordre de restitution alimente directement la génération du bail : les
  // services trient explicitement ces collections par id (cf. AppartementService).
  @OneToMany(() => Chambre, (chambre) => chambre.appartement)
  chambres!: Chambre[];

  @OneToMany(
    () => Caracteristique,
    (caracteristique) => caracteristique.appartement,
  )
  caracteristiques!: Caracteristique[];

  @Column({ name: 'energie_heating', type: 'varchar', length: 255 })
  energieHeating!: string;

  @Column({
    name: 'energie_water',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  energieWater!: string | null;

  @Column({ name: 'chauffage_collectif', type: 'boolean' })
  chauffageCollectif!: boolean;

  @Column({ name: 'bank_name', type: 'text', nullable: true })
  bankName!: string | null;

  @Column({ type: 'text', nullable: true })
  restrictions!: string | null;

  @Column({
    name: 'construction_period',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  constructionPeriod!: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  surface!: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  charges!: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  loyers!: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  caution!: number | null;

  @Column({ name: 'pet_rule', type: 'varchar', length: 255, nullable: true })
  petRule!: string | null;

  @Column({
    name: 'rent_ref',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  rentRef!: number | null;

  @Column({
    name: 'rent_ref_maj',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  rentRefMaj!: number | null;

  @Column({ name: 'val_irl', type: 'varchar', length: 255, nullable: true })
  valIrl!: string | null;

  @Column({ name: 't_irl', type: 'varchar', length: 255, nullable: true })
  tIrl!: string | null;

  /**
   * `true` lorsque l'IRL a été saisi à la main : dans ce cas les lectures ne le
   * remplacent pas par la dernière valeur publiée par l'INSEE.
   */
  @Column({ name: 'irl_manual', type: 'boolean', default: false })
  irlManual!: boolean;

  /**
   * Préfixe des fichiers d'annexe de `assets/docx/doc-annexe/` (« Filature »,
   * « Chateau_Gaillard », « Rue_René »), auquel le front ajoute le numéro de
   * chambre. Plusieurs logements d'une même résidence le partagent.
   */
  @Column({ name: 'prefixe_annexe', type: 'varchar', length: 255 })
  prefixeAnnexe!: string;

  @Column({ name: 'a_loggia', type: 'boolean', default: false })
  aLoggia!: boolean;

  @Column({ name: 'a_garage_poubelle', type: 'boolean', default: false })
  aGaragePoubelle!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  etage!: string | null;
}
