import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { numericTransformer } from '../common/numeric.transformer';

@Entity('locataire')
export class Locataire {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: numericTransformer,
  })
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  nom!: string;

  @Column({ type: 'varchar', length: 255 })
  prenom!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  telephone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  /**
   * Pas de relation inverse sur Appartement : l'ajouter changerait le JSON déjà
   * renvoyé par /appartement, qui sérialise l'entité via AppartementDto.
   */
  @ManyToOne(() => Appartement, { nullable: false })
  @JoinColumn({ name: 'appartement_id' })
  appartement!: Appartement;
}
