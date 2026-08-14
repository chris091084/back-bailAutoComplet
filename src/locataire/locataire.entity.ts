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
   * Date de naissance, dont la liste tire l'âge affiché. Nullable, rien ne la
   * renseigne à la génération du bail, elle se saisit depuis la fiche.
   *
   * Typée `string` (« AAAA-MM-JJ ») comme `entree` et `sortie` : le pilote rend
   * les colonnes `date` en chaîne, sans fuseau à réinterpréter.
   */
  @Column({ name: 'date_naissance', type: 'date', nullable: true })
  dateNaissance!: string | null;

  /**
   * Profession du locataire, saisie au formulaire de bail avec sa date de
   * naissance. Nullable, comme tout ce que la fiche ne rend pas obligatoire.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  profession!: string | null;

  /**
   * Date d'entrée dans le logement, reprise de `result_form.date_from` à la
   * création. Recopiée et non lue à travers la liaison : elle se corrige sans
   * toucher au bail généré, et survit à un détachement du result_form.
   *
   * Typée `string` (« AAAA-MM-JJ ») comme `sortie`, dont elle est la symétrique.
   */
  @Column({ type: 'date', nullable: true })
  entree!: string | null;

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

  /**
   * Date de départ du logement, `null` tant que le locataire est en place. Elle
   * remplace la suppression : un locataire sorti quitte la liste principale mais
   * garde son bail et ses quittances.
   *
   * Typée `string` (« AAAA-MM-JJ ») comme `ResultForm.from` : le pilote rend les
   * colonnes `date` en chaîne, sans fuseau à réinterpréter.
   */
  @Column({ type: 'date', nullable: true })
  sortie!: string | null;
}
