import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Échecs tolérés par adresse IP dans la fenêtre avant de la verrouiller. */
export const MAX_FAILURES_PER_IP = 5;

/**
 * Filet de secours contre une attaque répartie sur beaucoup d'adresses : au-delà,
 * la connexion par mot de passe est suspendue pour tout le monde. Bien plus haut
 * que le seuil par IP, pour qu'un seul attaquant ne puisse pas y arriver seul.
 */
export const MAX_FAILURES_GLOBAL = 30;

const WINDOW_SECONDS = 15 * 60;

/** Longueur de la colonne `login_failure.ip`. */
const IP_MAX_LENGTH = 64;

interface FailureCounts {
  mine: number;
  total: number;
  mine_retry: number;
  total_retry: number;
}

/**
 * Limitation des tentatives de connexion par mot de passe.
 *
 * Seul le mot de passe se devine : les passkeys reposent sur une signature que
 * personne ne peut deviner, et le lien magique porte 256 bits d'aléa. Les
 * verrouiller ne protégerait de rien et permettrait seulement à un tiers de
 * bloquer le propriétaire — ils n'utilisent donc pas ce service.
 *
 * Les échecs sont comptés EN BASE, pas en mémoire : l'état survit aux
 * redémarrages et reste commun à toutes les instances.
 *
 * Deux seuils :
 *  - par IP : un attaquant ne verrouille que sa propre adresse, pas le
 *    propriétaire. Suppose que l'API voie la vraie IP du client (`TRUST_PROXY`) ;
 *    sans cela tous les visiteurs ont l'IP du proxy et partagent ce seuil.
 *  - global : filet de secours, voir `MAX_FAILURES_GLOBAL`.
 */
@Injectable()
export class LoginThrottleService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Lève 429 si cette IP, ou l'ensemble des visiteurs, a trop échoué. */
  async assertNotLocked(ip: string): Promise<void> {
    const [counts] = await this.dataSource.query<FailureCounts[]>(
      `SELECT
         (COUNT(*) FILTER (WHERE "ip" = $1))::int AS "mine",
         COUNT(*)::int AS "total",
         COALESCE(CEIL(EXTRACT(EPOCH FROM (
           MIN("created_at") FILTER (WHERE "ip" = $1)
             + make_interval(secs => $2) - NOW()
         ))), 0)::int AS "mine_retry",
         COALESCE(CEIL(EXTRACT(EPOCH FROM (
           MIN("created_at") + make_interval(secs => $2) - NOW()
         ))), 0)::int AS "total_retry"
       FROM "login_failure"
       WHERE "created_at" > NOW() - make_interval(secs => $2)`,
      [this.normalize(ip), WINDOW_SECONDS],
    );

    if (counts.mine >= MAX_FAILURES_PER_IP) {
      this.reject(counts.mine_retry);
    }

    if (counts.total >= MAX_FAILURES_GLOBAL) {
      this.reject(counts.total_retry);
    }
  }

  async registerFailure(ip: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO "login_failure" ("ip") VALUES ($1)`,
      [this.normalize(ip)],
    );

    // Ménage au passage : les lignes sorties de la fenêtre ne servent plus.
    await this.dataSource.query(
      `DELETE FROM "login_failure"
        WHERE "created_at" <= NOW() - make_interval(secs => $1)`,
      [WINDOW_SECONDS],
    );
  }

  /** Efface les échecs de cette IP après une connexion réussie. */
  async reset(ip: string): Promise<void> {
    await this.dataSource.query(`DELETE FROM "login_failure" WHERE "ip" = $1`, [
      this.normalize(ip),
    ]);
  }

  private normalize(ip: string | undefined): string {
    return (ip?.trim() || 'inconnue').slice(0, IP_MAX_LENGTH);
  }

  private reject(retryAfterSeconds: number): never {
    const retryAfter = Math.max(retryAfterSeconds, 1);

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Trop de tentatives échouées, réessayez dans ${retryAfter} secondes`,
        retryAfter,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
