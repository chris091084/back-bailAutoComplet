import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EdlElement } from './edl-element.entity';
import { AuteurModification } from './etat-des-lieux.enums';

/** Les champs d'un élément que l'historique photographie avant/après. */
export interface InstantaneElement {
  etatLocataire: string | null;
  commentaireLocataire: string | null;
  statutValidation: string;
}

/**
 * Journal des modifications d'un élément : ce que contenait la ligne avant, ce
 * qu'elle contient après, qui, quand. Précieux en cas de litige sur un état des
 * lieux. Append-only : rien ne le met à jour.
 */
@Entity('edl_element_historique')
export class EdlElementHistorique {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'element_id', type: 'uuid' })
  elementId!: string;

  @ManyToOne(() => EdlElement, (element) => element.historique, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'element_id' })
  element!: EdlElement;

  @Column({ type: 'varchar', length: 20 })
  auteur!: AuteurModification;

  @Column({ name: 'ancienne_valeur', type: 'jsonb' })
  ancienneValeur!: InstantaneElement;

  @Column({ name: 'nouvelle_valeur', type: 'jsonb' })
  nouvelleValeur!: InstantaneElement;

  /** Horodatage de la saisie côté appareil (peut précéder `creeLe` hors-ligne). */
  @Column({ name: 'modifie_le_client', type: 'timestamptz', nullable: true })
  modifieLeClient!: Date | null;

  @Column({ name: 'cree_le', type: 'timestamptz', default: () => 'NOW()' })
  creeLe!: Date;
}
