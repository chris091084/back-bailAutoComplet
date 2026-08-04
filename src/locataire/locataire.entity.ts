import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { numericTransformer } from '../common/numeric.transformer';
import { ResultForm } from '../generation/result-form.entity';

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

  /**
   * Le result_form dont ce locataire est issu : il porte notamment `date_from`,
   * la date de signature du bail reprise dans la lettre de congé. Nullable, les
   * locataires saisis avant l'ajout de la colonne n'en ont pas.
   */
  @ManyToOne(() => ResultForm, { nullable: true })
  @JoinColumn({ name: 'result_form_id' })
  resultForm!: ResultForm | null;

  /**
   * Date d'envoi de la lettre de congé, `null` tant qu'aucune n'est partie.
   * Renseignée par le front une fois le mail accepté par /mail/send.
   */
  @Column({
    name: 'resiliation_envoyee_le',
    type: 'timestamptz',
    nullable: true,
  })
  resiliationEnvoyeeLe!: Date | null;
}
