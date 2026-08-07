import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { numericTransformer } from '../common/numeric.transformer';

@Entity('caracteristique')
export class Caracteristique {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: numericTransformer,
  })
  id!: number;

  @Column({ type: 'text' })
  description!: string;

  @ManyToOne(() => Appartement, (appartement) => appartement.caracteristiques)
  @JoinColumn({ name: 'appartement_id' })
  appartement!: Appartement;
}
