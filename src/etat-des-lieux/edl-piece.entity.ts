import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EdlElement } from './edl-element.entity';
import { EtatDesLieux } from './etat-des-lieux.entity';

/** Une pièce du logement (« Chambre 4 », « Cuisine »…) : un tableau du Word. */
@Entity('edl_piece')
export class EdlPiece {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'etat_des_lieux_id', type: 'uuid' })
  etatDesLieuxId!: string;

  @ManyToOne(() => EtatDesLieux, (edl) => edl.pieces, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'etat_des_lieux_id' })
  etatDesLieux!: EtatDesLieux;

  @Column({ type: 'varchar', length: 255 })
  nom!: string;

  @Column({ type: 'int' })
  ordre!: number;

  @OneToMany(() => EdlElement, (element) => element.piece, {
    cascade: ['insert'],
  })
  elements!: EdlElement[];
}
