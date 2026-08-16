import { Exclude } from 'class-transformer';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { numericTransformer } from '../common/numeric.transformer';

@Entity('chambre')
export class Chambre {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: numericTransformer,
  })
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  piece!: string;

  @ManyToOne(() => Appartement, (appartement) => appartement.chambres)
  @JoinColumn({ name: 'appartement_id' })
  appartement!: Appartement;

  // Non exposée par l'API : l'entité Java n'avait pas de getter pour ce champ,
  // Jackson ne le sérialisait donc pas. @Exclude reproduit cette omission
  // partout où l'entité est renvoyée telle quelle (cf. /generation).
  @Exclude()
  @Column({
    name: 'caracteristique_exceptionelle',
    type: 'varchar',
    length: 250,
    nullable: true,
  })
  caracteristiqueExceptionelle!: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  couleur!: string | null;
}
