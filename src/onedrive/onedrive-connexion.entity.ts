import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Identifiant de l'unique ligne : l'application n'a qu'un OneDrive (celui du bailleur). */
export const ONEDRIVE_CONNEXION_ID = 1;

export type StatutConnexionOneDrive = 'connecte' | 'revoque';

@Entity('onedrive_connexion')
export class OneDriveConnexion {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  /**
   * Refresh token CHIFFRÉ (AES-256-GCM, voir `common/chiffrement.ts`). Jamais
   * lu en clair hors du service d'authentification, jamais journalisé.
   */
  @Column({ name: 'refresh_token_chiffre', type: 'text' })
  refreshTokenChiffre!: string;

  @Column({ type: 'varchar', length: 10, default: 'connecte' })
  statut!: StatutConnexionOneDrive;

  @Column({ name: 'connecte_le', type: 'timestamptz', default: () => 'NOW()' })
  connecteLe!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
