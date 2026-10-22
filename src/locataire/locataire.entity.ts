import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { encryptedTransformer } from '../common/encrypted.transformer';
import { numericTransformer } from '../common/numeric.transformer';
import { ResultForm } from '../generation/result-form.entity';
import { EtatLocataire } from './locataire-etat.enum';

@Entity('locataire')
export class Locataire {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: numericTransformer,
  })
  id!: number;

  @Column({ type: 'text', transformer: encryptedTransformer })
  nom!: string;

  @Column({ type: 'text', transformer: encryptedTransformer })
  prenom!: string;

  @Column({ type: 'text', nullable: true, transformer: encryptedTransformer })
  telephone!: string | null;

  @Column({ type: 'text', nullable: true, transformer: encryptedTransformer })
  email!: string | null;

  /**
   * Date de naissance, dont la liste tire l'âge affiché. Nullable, rien ne la
   * renseigne à la génération du bail, elle se saisit depuis la fiche.
   *
   * Typée `string` (« AAAA-MM-JJ ») comme `entree` et `sortie`. Chiffrée : la
   * colonne est du texte (plus un `date`), l'âge se calcule côté front.
   */
  @Column({
    name: 'date_naissance',
    type: 'text',
    nullable: true,
    transformer: encryptedTransformer,
  })
  dateNaissance!: string | null;

  /**
   * Profession du locataire, saisie au formulaire de bail avec sa date de
   * naissance. Nullable, comme tout ce que la fiche ne rend pas obligatoire.
   */
  @Column({ type: 'text', nullable: true, transformer: encryptedTransformer })
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
   * Où en est la fiche dans son cycle de vie. Une fiche naît `candidat` : le
   * bail est généré, rien n'est signé. La signature la passe `locataire`, le
   * départ la passe `sorti`.
   *
   * C'est la seule source de vérité de l'état, `sortie` n'étant plus que la
   * date du départ : les transitions écrivent les deux, et rien ne déduit plus
   * l'état d'une date. Volontairement absent d'`UpsertLocataireDto` — il se
   * change par les routes-événements, jamais par la modale d'édition.
   */
  @Column({ type: 'varchar', length: 20, default: EtatLocataire.CANDIDAT })
  etat!: EtatLocataire;

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
   * Date d'envoi du projet de bail au candidat, `null` tant qu'aucun n'est
   * parti. Renseignée par le front une fois le mail accepté par /mail/send.
   *
   * Concerne le bail relu et envoyé, pas le bail généré : un bail peut être
   * produit puis gardé de côté, la date ne se pose qu'à l'envoi.
   */
  @Column({ name: 'bail_envoye_le', type: 'timestamptz', nullable: true })
  bailEnvoyeLe!: Date | null;

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
   * Depuis l'ajout d'`etat`, elle ne range plus la fiche : c'est une date de
   * détail, écrite en même temps que le passage à `sorti`.
   *
   * Typée `string` (« AAAA-MM-JJ ») comme `ResultForm.from` : le pilote rend les
   * colonnes `date` en chaîne, sans fuseau à réinterpréter.
   */
  @Column({ type: 'date', nullable: true })
  sortie!: string | null;

  /**
   * Exception à la purge RGPD : à `true`, la fiche n'est pas supprimée 3 ans
   * après la sortie (litige en cours, obligation de conservation plus longue).
   * Se change par `PUT /:id/conservation`, jamais par la modale d'édition, et
   * seulement sur un locataire sorti : c'est le seul que la purge vise.
   */
  @Column({ name: 'conservation_prolongee', type: 'boolean', default: false })
  conservationProlongee!: boolean;
}
