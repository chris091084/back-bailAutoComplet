import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { EdlElement } from './edl-element.entity';
import { StatutSyncPhoto } from './etat-des-lieux.enums';

/**
 * Une photo d'élément. Le fichier vit sur OneDrive : la base ne garde que son
 * identifiant et son lien.
 *
 * L'identifiant est choisi par le CLIENT (UUID généré à la prise de vue) : un
 * envoi rejoué après une coupure réseau retombe sur la même ligne au lieu de
 * créer un doublon.
 */
@Entity('edl_photo')
export class EdlPhoto {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'element_id', type: 'uuid' })
  elementId!: string;

  @ManyToOne(() => EdlElement, (element) => element.photos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'element_id' })
  element!: EdlElement;

  @Column({
    name: 'onedrive_item_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  oneDriveItemId!: string | null;

  @Column({ name: 'onedrive_url', type: 'text', nullable: true })
  oneDriveUrl!: string | null;

  @Column({
    name: 'statut_sync',
    type: 'varchar',
    length: 10,
    default: StatutSyncPhoto.PENDING,
  })
  statutSync!: StatutSyncPhoto;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
