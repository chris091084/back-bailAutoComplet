import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { numericTransformer } from '../common/numeric.transformer';
import { Locataire } from '../locataire/locataire.entity';
import { EdlPiece } from './edl-piece.entity';
import { StatutEtatDesLieux, TypeEtatDesLieux } from './etat-des-lieux.enums';

/**
 * Un état des lieux d'entrée ou de sortie, rempli par le locataire depuis un
 * lien à jeton signé.
 */
@Entity('etat_des_lieux')
export class EtatDesLieux {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 10 })
  type!: TypeEtatDesLieux;

  @Column({ type: 'varchar', length: 10, default: StatutEtatDesLieux.DRAFT })
  statut!: StatutEtatDesLieux;

  @Column({
    name: 'appartement_id',
    type: 'bigint',
    transformer: numericTransformer,
  })
  appartementId!: number;

  @ManyToOne(() => Appartement, { nullable: false })
  @JoinColumn({ name: 'appartement_id' })
  appartement!: Appartement;

  @Column({
    name: 'locataire_id',
    type: 'bigint',
    transformer: numericTransformer,
  })
  locataireId!: number;

  @ManyToOne(() => Locataire, { nullable: false })
  @JoinColumn({ name: 'locataire_id' })
  locataire!: Locataire;

  /**
   * Sortie uniquement : l'état d'entrée signé dont les valeurs servent de
   * référence. `SET NULL` en base pour survivre à la purge de l'entrée.
   */
  @Column({ name: 'etat_entree_ref_id', type: 'uuid', nullable: true })
  etatEntreeRefId!: string | null;

  @Column({
    name: 'date_creation',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  dateCreation!: Date;

  @Column({ name: 'date_signature', type: 'timestamptz', nullable: true })
  dateSignature!: Date | null;

  /** PNG en base64 (sans le préfixe `data:`). Jamais journalisé. */
  @Column({ name: 'signature_bailleur', type: 'text', nullable: true })
  signatureBailleur!: string | null;

  @Column({ name: 'signature_locataire', type: 'text', nullable: true })
  signatureLocataire!: string | null;

  // --- Infos générales, figées à la création : le document signé ne doit pas
  // changer parce que la fiche du logement est modifiée après coup.
  @Column({ type: 'varchar', length: 255 })
  adresse!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  chauffage!: string | null;

  @Column({ name: 'cles_remises', type: 'text', nullable: true })
  clesRemises!: string | null;

  /**
   * Identifiant de la version courante du lien envoyé au locataire. Le jeton
   * JWT le porte : régénérer le lien change `lienJti` et invalide les anciens
   * jetons, même non expirés.
   */
  @Column({ name: 'lien_jti', type: 'uuid' })
  lienJti!: string;

  @Column({ name: 'lien_expire_le', type: 'timestamptz' })
  lienExpireLe!: Date;

  /**
   * SHA-256 du contenu au moment de la signature (voir `empreinte.ts`) : preuve
   * que le document n'a pas changé depuis.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  empreinte!: string | null;

  /** Dernier envoi réussi du PDF par e-mail, `null` tant qu'aucun n'est parti. */
  @Column({ name: 'pdf_envoye_le', type: 'timestamptz', nullable: true })
  pdfEnvoyeLe!: Date | null;

  /** Le PDF archivé dans le OneDrive du bailleur, à côté des photos. */
  @Column({
    name: 'pdf_onedrive_item_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  pdfOneDriveItemId!: string | null;

  @OneToMany(() => EdlPiece, (piece) => piece.etatDesLieux, {
    cascade: ['insert'],
  })
  pieces!: EdlPiece[];
}
