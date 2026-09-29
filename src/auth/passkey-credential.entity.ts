import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Un passkey enregistré pour l'unique compte. Plusieurs peuvent coexister
 * (téléphone, ordinateur, clé physique) : perdre l'un d'eux ne bloque pas l'accès.
 */
@Entity('passkey_credential')
export class PasskeyCredential {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Identifiant du credential, en base64url, tel que le fournit l'authentificateur. */
  @Column({ name: 'credential_id', type: 'varchar', length: 512, unique: true })
  credentialId!: string;

  @Column({ name: 'public_key', type: 'bytea' })
  publicKey!: Buffer;

  /** bigint est renvoyé en chaîne par pg : converti en nombre à la lecture. */
  @Column({
    type: 'bigint',
    default: 0,
    transformer: {
      to: (value: number): number => value,
      from: (value: string | number): number => Number(value),
    },
  })
  counter!: number;

  /** Transports annoncés à l'enregistrement, séparés par des virgules. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  transports!: string | null;

  @Column({ type: 'varchar', length: 100 })
  label!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt!: Date | null;
}
