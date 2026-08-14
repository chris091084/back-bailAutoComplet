import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { ResultForm } from './result-form.entity';

@Entity('generation')
export class Generation {
  // Hibernate (GenerationType.UUID) générait l'identifiant côté application et
  // le stockait en varchar : GenerationService fait de même via randomUUID().
  @PrimaryColumn({ type: 'varchar', length: 255 })
  id!: string;

  @Column({ type: 'timestamp' })
  date!: Date;

  @Column({ name: 'appartement_name', type: 'varchar', length: 255 })
  appartementName!: string;

  @Column({ name: 'locataire_name', type: 'varchar', length: 255 })
  locataireName!: string;

  @OneToOne(() => ResultForm, { cascade: true, nullable: true, eager: true })
  @JoinColumn({ name: 'result_form_id' })
  resultForm!: ResultForm | null;
}
