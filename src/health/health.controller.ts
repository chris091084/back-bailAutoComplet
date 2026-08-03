import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Corps renvoyé quand l'API et sa base répondent. */
export interface ReadinessUp {
  status: 'UP';
  database: 'UP';
  /** Millisecondes depuis le démarrage du process : proche de 0 = démarrage à froid. */
  uptimeMs: number;
}

/** Corps renvoyé en 503 tant que la base ne répond pas. */
export interface ReadinessStarting {
  status: 'STARTING';
  database: 'DOWN';
  uptimeMs: number;
}

/**
 * Au-delà de ce délai, on préfère répondre 503 plutôt que laisser la requête
 * pendre : le front garde ainsi la main pour afficher sa progression et
 * repoller, au lieu de rester bloqué sur une connexion ouverte.
 */
const READINESS_TIMEOUT_MS = Number(process.env.READINESS_TIMEOUT_MS ?? 4000);

@Controller('actuator/health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Remplace le endpoint `/actuator/health` de spring-boot-starter-actuator,
   * utilisé par le health check de l'hébergeur. Volontairement sans accès base :
   * il répond dès que le process écoute, c'est un test de vivacité, pas de
   * disponibilité.
   */
  @Get()
  health(): { status: string } {
    return { status: 'UP' };
  }

  /**
   * Disponibilité réelle, destinée à l'écran de chargement du front.
   *
   * Sur un hébergement qui met le conteneur à l'échelle zéro (Scaleway
   * Serverless Containers), la première requête réveille l'instance et n'obtient
   * de réponse qu'une fois celle-ci démarrée : le simple fait que cet appel
   * aboutisse signifie que l'API est chaude. On y ajoute un `SELECT 1` car la
   * base peut, elle aussi, être encore en train de se réveiller — l'écran de
   * chargement doit rester affiché tant que le premier login échouerait.
   *
   * Route publique : aucun guard, elle est interrogée avant toute
   * authentification.
   */
  @Get('readiness')
  @Header('Cache-Control', 'no-store')
  async readiness(): Promise<ReadinessUp> {
    const uptimeMs: number = Math.round(process.uptime() * 1000);

    if (!(await this.pingDatabase())) {
      const body: ReadinessStarting = {
        status: 'STARTING',
        database: 'DOWN',
        uptimeMs,
      };

      throw new ServiceUnavailableException(body);
    }

    return { status: 'UP', database: 'UP', uptimeMs };
  }

  /**
   * `SELECT 1` borné dans le temps. Le pool pg ne propose pas de timeout par
   * requête ici, d'où la course avec un minuteur ; l'échec n'est pas propagé,
   * un réveil en cours n'est pas une erreur à signaler dans les logs.
   */
  private async pingDatabase(): Promise<boolean> {
    let minuteur: NodeJS.Timeout | undefined;

    const expiration = new Promise<never>((_, reject) => {
      minuteur = setTimeout(
        () => reject(new Error('readiness timeout')),
        READINESS_TIMEOUT_MS,
      );
    });

    try {
      await Promise.race([this.dataSource.query('SELECT 1'), expiration]);

      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(minuteur);
    }
  }
}
