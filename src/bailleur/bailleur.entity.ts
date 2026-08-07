import { Column, Entity, PrimaryColumn } from 'typeorm';
import { numericTransformer } from '../common/numeric.transformer';

@Entity('bailleur')
export class Bailleur {
  @PrimaryColumn({
    type: 'bigint',
    generated: 'increment',
    transformer: numericTransformer,
  })
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  adress!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 50 })
  telephone!: string;
}
