import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Identifiant de l'unique ligne de la table : l'application n'a qu'un seul
 * compte, donc au plus une session ouverte à la fois.
 */
export const SINGLE_ACCOUNT_ID = 1;

/**
 * L'unique compte de l'application.
 *
 * `passwordHash` à `null` signifie « pas encore semé » : `/auth/login` refuse
 * alors toute connexion, et l'API le signale par un avertissement au démarrage.
 * Ce champ ne s'écrit que depuis `npm run auth:seed`, jamais par HTTP.
 *
 * `refreshTokenHash` à `null` signifie « déconnecté » : tout refresh présenté
 * est rejeté. C'est ce champ qui rend le refresh token révocable — sans lui, un
 * jeton volé resterait valable sept jours sans moyen de le couper.
 */
@Entity('auth_account')
export class AuthAccount {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  passwordHash!: string | null;

  @Column({
    name: 'refresh_token_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  refreshTokenHash!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
