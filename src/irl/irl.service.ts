import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLParser } from 'fast-xml-parser';
import { IrlDto } from './dto/irl.dto';

/**
 * Récupère la dernière valeur de l'IRL (Indice de Référence des Loyers) publiée
 * par l'INSEE via le service web SDMX public de la BDM (Banque de Données
 * Macroéconomiques). Aucune clé API n'est nécessaire pour cet endpoint.
 *
 * La valeur est mise en cache en mémoire : l'IRL n'étant publié qu'une fois par
 * trimestre, on évite d'interroger l'INSEE à chaque appel.
 */
@Injectable()
export class IrlService {
  private readonly logger = new Logger(IrlService.name);

  private readonly baseUrl: string;
  private readonly idbank: string;
  private readonly cacheTtlHours: number;

  private cachedIrl: IrlDto | null = null;
  private cachedAt: number | null = null;

  constructor(configService: ConfigService) {
    this.baseUrl = configService.get<string>(
      'INSEE_BDM_BASE_URL',
      'https://www.bdm.insee.fr/series/sdmx/data/SERIES_BDM',
    );
    this.idbank = configService.get<string>('INSEE_IRL_IDBANK', '001515333');
    this.cacheTtlHours = Number(
      configService.get<string>('INSEE_IRL_CACHE_TTL_HOURS', '6'),
    );
  }

  /**
   * @returns la dernière valeur IRL disponible, ou `null` si l'INSEE est
   * injoignable ou la réponse illisible (l'appelant conserve alors la valeur
   * déjà stockée en base).
   */
  async getLatestIrl(): Promise<IrlDto | null> {
    const cached = this.cachedIrl;
    const ttlMs = this.cacheTtlHours * 60 * 60 * 1000;

    if (
      cached &&
      this.cachedAt !== null &&
      Date.now() - this.cachedAt < ttlMs
    ) {
      return cached;
    }

    try {
      const fresh = await this.fetchLatestIrl();

      if (fresh) {
        this.cachedIrl = fresh;
        this.cachedAt = Date.now();
        return fresh;
      }

      // En cas d'échec ponctuel, on renvoie l'éventuelle valeur en cache
      // (même expirée).
      return cached;
    } catch (error) {
      this.logger.warn(
        `Impossible de récupérer l'IRL depuis l'INSEE : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return cached;
    }
  }

  private async fetchLatestIrl(): Promise<IrlDto | null> {
    // On limite la fenêtre aux 3 dernières années pour une réponse légère.
    const startPeriod = new Date().getUTCFullYear() - 2;
    const url = `${this.baseUrl}/${this.idbank}?startPeriod=${startPeriod}`;

    const response = await fetch(url, {
      headers: { Accept: 'application/xml' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      this.logger.warn(
        `L'INSEE a répondu avec le code HTTP ${response.status}`,
      );
      return null;
    }

    return this.parseLatestObservation(await response.text());
  }

  /**
   * Parse la réponse SDMX (StructureSpecificData) et retourne l'observation la
   * plus récente. Les `<Obs>` portent les attributs `TIME_PERIOD`
   * (ex. « 2026-Q1 ») et `OBS_VALUE` (ex. « 146.6 »).
   */
  private parseLatestObservation(body: string): IrlDto | null {
    // Durcissement anti-XXE : on ne lit que des données, pas de DTD.
    if (/<!DOCTYPE/i.test(body)) {
      this.logger.warn(
        'Réponse INSEE rejetée : elle contient une déclaration DOCTYPE',
      );
      return null;
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true,
    });

    const observations = this.collectObservations(parser.parse(body));

    let bestPeriod: string | null = null;
    let bestValue: string | null = null;

    for (const observation of observations) {
      const period = observation.TIME_PERIOD;
      const value = observation.OBS_VALUE;

      if (!period || !value) {
        continue;
      }

      // Le format « YYYY-Qn » se trie correctement en ordre lexicographique.
      if (bestPeriod === null || period > bestPeriod) {
        bestPeriod = period;
        bestValue = value;
      }
    }

    if (bestPeriod === null || bestValue === null) {
      this.logger.warn(
        "Aucune observation IRL trouvée dans la réponse de l'INSEE",
      );
      return null;
    }

    return { valIrl: bestValue, tIrl: this.formatTrimestre(bestPeriod) };
  }

  /**
   * Les `<Obs>` sont imbriquées à une profondeur variable selon le format SDMX
   * renvoyé : on parcourt donc tout l'arbre plutôt que de figer un chemin.
   */
  private collectObservations(
    node: unknown,
    accumulator: Array<Record<string, string>> = [],
  ): Array<Record<string, string>> {
    if (Array.isArray(node)) {
      for (const item of node) {
        this.collectObservations(item, accumulator);
      }
      return accumulator;
    }

    if (node === null || typeof node !== 'object') {
      return accumulator;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'Obs') {
        const observations = Array.isArray(value) ? value : [value];
        for (const observation of observations) {
          if (observation && typeof observation === 'object') {
            accumulator.push(observation as Record<string, string>);
          }
        }
        continue;
      }

      this.collectObservations(value, accumulator);
    }

    return accumulator;
  }

  /** Transforme une période SDMX « 2026-Q1 » en libellé de trimestre « T1 2026 ». */
  private formatTrimestre(timePeriod: string): string {
    const parts = timePeriod.split('-Q');
    return parts.length === 2 ? `T${parts[1]} ${parts[0]}` : timePeriod;
  }
}
