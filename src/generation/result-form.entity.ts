import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { Bailleur } from '../bailleur/bailleur.entity';
import { numericTransformer } from '../common/numeric.transformer';

@Entity('result_form')
export class ResultForm {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: numericTransformer,
  })
  id!: number;

  @Column({ type: 'text', nullable: true })
  adress!: string | null;

  @ManyToOne(() => Appartement, { nullable: true })
  @JoinColumn({ name: 'appartement_id' })
  appartement!: Appartement | null;

  @Column({
    name: 'charge_price',
    type: 'decimal',
    precision: 19,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  chargePrice!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  firstname!: string | null;

  @Column({ name: 'date_from', type: 'date', nullable: true })
  from!: string | null;

  @Column({ name: 'date_to', type: 'date', nullable: true })
  to!: string | null;

  @Column({ type: 'text', nullable: true })
  motif!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({
    name: 'price_no_charge',
    type: 'decimal',
    precision: 19,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  priceNoCharge!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  room!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  telephone!: string | null;

  @ManyToOne(() => Bailleur, { nullable: true })
  @JoinColumn({ name: 'bailleur_id' })
  bailleur!: Bailleur | null;

  @Column({ name: 'bail_type', type: 'varchar', length: 255, nullable: true })
  bailType!: string | null;

  @Column({ name: 't_irl', type: 'varchar', length: 255, nullable: true })
  tIrl!: string | null;

  @Column({ name: 'val_irl', type: 'varchar', length: 255, nullable: true })
  valIrl!: string | null;

  @Column({
    name: 'last_price_without_charge',
    type: 'decimal',
    precision: 19,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  lastPriceWithoutCharge!: number | null;

  @Column({ name: 'charge_list', type: 'boolean', nullable: true })
  chargeList!: boolean | null;

  @Column({ name: 'clause_less_6_month', type: 'boolean', nullable: true })
  clauseLess6Month!: boolean | null;

  @Column({
    name: 'type_residence',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  typeResidence!: string | null;

  @Column({
    name: 'rent_ref',
    type: 'decimal',
    precision: 19,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  rentRef!: number | null;

  @Column({
    name: 'rent_ref_maj',
    type: 'decimal',
    precision: 19,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  rentRefMaj!: number | null;

  /**
   * Type de garantie du bail (« Visale », « Garant physique »), repris dans le
   * mail d'envoi du projet de bail (Annexe 2 : engagement de cautionnement).
   */
  @Column({
    name: 'garantie_type',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  garantieType!: string | null;
}
