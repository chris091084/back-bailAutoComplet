import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EdlElementHistorique } from './edl-element-historique.entity';
import { EdlPhoto } from './edl-photo.entity';
import { EdlPiece } from './edl-piece.entity';
import { EtatElement } from './etat-element.enum';
import { StatutValidation } from './etat-des-lieux.enums';

/**
 * Une ligne du formulaire : « Murs », « Sols », « Fenêtres »… d'une pièce.
 *
 * Deux voix coexistent : la valeur de RÉFÉRENCE (`*Bailleur`, en lecture seule
 * côté locataire — pour une sortie, c'est l'état retenu à l'entrée) et la
 * saisie du LOCATAIRE (`*Locataire`).
 */
@Entity('edl_element')
export class EdlElement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'piece_id', type: 'uuid' })
  pieceId!: string;

  @ManyToOne(() => EdlPiece, (piece) => piece.elements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'piece_id' })
  piece!: EdlPiece;

  @Column({ type: 'varchar', length: 255 })
  nom!: string;

  @Column({ type: 'int' })
  ordre!: number;

  /**
   * L'élément de l'état d'entrée dont celui-ci reprend la valeur (sortie
   * uniquement). `SET NULL` en base : purger l'entrée ne doit pas emporter la
   * sortie.
   */
  @Column({ name: 'element_entree_ref_id', type: 'uuid', nullable: true })
  elementEntreeRefId!: string | null;

  @Column({
    name: 'etat_bailleur',
    type: 'varchar',
    length: 12,
    nullable: true,
  })
  etatBailleur!: EtatElement | null;

  @Column({ name: 'commentaire_bailleur', type: 'text', nullable: true })
  commentaireBailleur!: string | null;

  @Column({
    name: 'etat_locataire',
    type: 'varchar',
    length: 12,
    nullable: true,
  })
  etatLocataire!: EtatElement | null;

  @Column({ name: 'commentaire_locataire', type: 'text', nullable: true })
  commentaireLocataire!: string | null;

  /**
   * Horodatage de la dernière saisie du locataire, posé par SON appareil (borné
   * à l'heure du serveur). C'est la référence de la résolution de conflits : le
   * serveur refuse une écriture dont l'horodatage est plus ancien que celui qu'il
   * détient déjà.
   */
  @Column({
    name: 'date_modif_locataire',
    type: 'timestamptz',
    nullable: true,
  })
  dateModifLocataire!: Date | null;

  @Column({
    name: 'statut_validation',
    type: 'varchar',
    length: 12,
    default: StatutValidation.A_VERIFIER,
  })
  statutValidation!: StatutValidation;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;

  @OneToMany(() => EdlPhoto, (photo) => photo.element)
  photos!: EdlPhoto[];

  @OneToMany(() => EdlElementHistorique, (historique) => historique.element)
  historique!: EdlElementHistorique[];
}
