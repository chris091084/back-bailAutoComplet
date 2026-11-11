import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoyersReferenceDto } from './dto/loyers-reference.dto';

/** Un jeu de données par arrêté préfectoral : « 2025_2026 », « 2026_2027 »… */
const NOMBRE_ARRETES_ESSAYES = 3;

/**
 * L'arrêté de l'année N entre en vigueur le 1er novembre N. Avant cette date,
 * c'est donc encore celui de l'année précédente qui s'applique.
 */
const MOIS_ENTREE_EN_VIGUEUR = 10; // novembre (les mois JS commencent à 0)

const DELAI_REQUETE_MS = 8_000;
const HEURES_EN_MS = 60 * 60 * 1000;

interface LoyersTranche {
  loyer_reference?: number;
  loyer_reference_majore?: number;
}

/** pièces → époque de construction → meublé / non meublé → loyers (€/m²). */
type ValeursZone = Record<
  string,
  Record<string, Record<string, LoyersTranche | undefined> | undefined>
>;

interface EntreeCache {
  valeur: LoyersReferenceDto | null;
  at: number;
}

/**
 * Retrouve les loyers de référence et de référence majoré (en €/m²) de
 * l'encadrement des loyers de la Métropole de Lyon (Lyon et Villeurbanne), à
 * partir de l'adresse et de l'époque de construction d'un logement.
 *
 * Deux API publiques, sans clé :
 *  1. la Base Adresse Nationale transforme l'adresse en coordonnées GPS ;
 *  2. le WFS de data.grandlyon.com (service géographique standard) renvoie la
 *     zone d'encadrement qui contient ce point, avec son tableau de loyers.
 *
 * Les résultats sont gardés en mémoire : les arrêtés ne changent qu'une fois
 * par an, inutile de réinterroger les API à chaque lecture.
 */
@Injectable()
export class EncadrementLoyersService {
  private readonly logger = new Logger(EncadrementLoyersService.name);

  private readonly banUrl: string;
  private readonly wfsUrl: string;
  private readonly nombrePieces: string;
  private readonly meuble: boolean;
  private readonly cacheTtlMs: number;

  private readonly cache = new Map<string, EntreeCache>();
  /** Requêtes en cours : deux logements identiques n'interrogent l'API qu'une fois. */
  private readonly enCours = new Map<
    string,
    Promise<LoyersReferenceDto | null>
  >();

  constructor(configService: ConfigService) {
    this.banUrl = configService.get<string>(
      'ENCADREMENT_BAN_BASE_URL',
      'https://api-adresse.data.gouv.fr',
    );
    this.wfsUrl = configService.get<string>(
      'ENCADREMENT_WFS_URL',
      'https://data.grandlyon.com/geoserver/metropole-de-lyon/ows',
    );
    // Les logements sont loués meublés, en colocation : c'est la ligne
    // « 4 pièces et plus, meublé » du tableau qui s'applique.
    this.nombrePieces = configService.get<string>(
      'ENCADREMENT_NB_PIECES',
      '4 et plus',
    );
    this.meuble =
      configService.get<string>('ENCADREMENT_MEUBLE', 'true') !== 'false';
    this.cacheTtlMs =
      Number(configService.get<string>('ENCADREMENT_CACHE_TTL_HOURS', '24')) *
      HEURES_EN_MS;
  }

  /**
   * @returns les loyers en €/m², ou `null` si le logement n'est pas dans une
   * zone encadrée, si l'époque de construction est inconnue ou si les API sont
   * injoignables (l'appelant conserve alors la valeur déjà stockée).
   */
  async getLoyersReference(
    adresse: string,
    constructionPeriod: string | null,
  ): Promise<LoyersReferenceDto | null> {
    const epoque = this.epoqueConstruction(constructionPeriod);
    if (!adresse.trim() || epoque === null) {
      return null;
    }

    const cle = `${adresse.trim().toLowerCase()}|${epoque}`;
    const enCache = this.cache.get(cle);
    if (enCache && Date.now() - enCache.at < this.cacheTtlMs) {
      return enCache.valeur;
    }

    let requete = this.enCours.get(cle);
    if (!requete) {
      requete = this.chercher(adresse, epoque)
        .then((valeur) => {
          this.cache.set(cle, { valeur, at: Date.now() });
          return valeur;
        })
        .catch((erreur: unknown) => {
          this.logger.warn(
            `Impossible de récupérer l'encadrement des loyers pour « ${adresse} » : ${
              erreur instanceof Error ? erreur.message : String(erreur)
            }`,
          );
          // En cas d'échec ponctuel, on renvoie l'éventuelle valeur en cache
          // (même expirée).
          return enCache?.valeur ?? null;
        })
        .finally(() => this.enCours.delete(cle));
      this.enCours.set(cle, requete);
    }

    return requete;
  }

  /**
   * Transforme « 1968 » ou « 1946-1970 » dans l'une des cinq tranches du jeu de
   * données (pour une fourchette, on retient l'année de départ).
   */
  epoqueConstruction(constructionPeriod: string | null): string | null {
    const annee = Number(/\d{4}/.exec(constructionPeriod ?? '')?.[0]);
    if (!annee) {
      return null;
    }
    if (annee < 1946) return 'avant 1946';
    if (annee <= 1970) return '1946-1970';
    if (annee <= 1990) return '1971-1990';
    if (annee <= 2005) return '1991-2005';
    return 'après 2005';
  }

  private async chercher(
    adresse: string,
    epoque: string,
  ): Promise<LoyersReferenceDto | null> {
    const point = await this.geocoder(adresse);
    if (point === null) {
      return null;
    }

    const valeurs = await this.trouverZone(point);
    if (valeurs === null) {
      return null;
    }

    const tranche =
      valeurs[this.nombrePieces]?.[epoque]?.[
        this.meuble ? 'meuble' : 'non meuble'
      ];
    const rentRef = tranche?.loyer_reference;
    const rentRefMaj = tranche?.loyer_reference_majore;

    if (typeof rentRef !== 'number' || typeof rentRefMaj !== 'number') {
      return null;
    }

    return { rentRef, rentRefMaj };
  }

  /**
   * Seule la Métropole de Lyon est encadrée : parmi les résultats de la BAN, on
   * garde le premier du Rhône. Cela permet aussi de retrouver une adresse saisie
   * sans ville (« 1 rue René »).
   *
   * Un suffixe de numéro (« 53A bis ») désoriente parfois la BAN : on retente
   * alors sans lui, la zone d'encadrement ne dépendant pas du numéro exact.
   */
  private async geocoder(
    adresse: string,
  ): Promise<{ lat: number; lon: number } | null> {
    const sansSuffixe = adresse.replace(
      /^\s*(\d+)\s*(?:[a-z]\b|bis\b|ter\b|quater\b)(?:\s*(?:bis|ter|quater)\b)?/i,
      '$1',
    );

    for (const requete of new Set([adresse, sansSuffixe])) {
      const point = await this.geocoderUneAdresse(requete);
      if (point !== null) {
        return point;
      }
    }

    return null;
  }

  private async geocoderUneAdresse(
    adresse: string,
  ): Promise<{ lat: number; lon: number } | null> {
    const url = new URL('/search/', this.banUrl);
    url.searchParams.set('q', adresse);
    url.searchParams.set('limit', '5');

    const reponse = await this.requeter(url);
    const corps = (await reponse.json()) as {
      features?: {
        geometry: { coordinates: [number, number] };
        properties: { depcode?: string; score?: number };
      }[];
    };

    const trouve = (corps.features ?? []).find(
      (feature) =>
        feature.properties.depcode === '69' &&
        (feature.properties.score ?? 0) >= 0.5,
    );

    return trouve
      ? {
          lon: trouve.geometry.coordinates[0],
          lat: trouve.geometry.coordinates[1],
        }
      : null;
  }

  /**
   * Interroge l'arrêté en vigueur, puis les précédents si le jeu de données
   * n'est pas (encore) publié. Une réponse vide d'un jeu de données existant
   * signifie « hors zone » : inutile de remonter plus loin.
   */
  private async trouverZone(point: {
    lat: number;
    lon: number;
  }): Promise<ValeursZone | null> {
    const maintenant = new Date();
    const anneeArrete =
      maintenant.getUTCMonth() >= MOIS_ENTREE_EN_VIGUEUR
        ? maintenant.getUTCFullYear()
        : maintenant.getUTCFullYear() - 1;

    let derniereErreur: unknown = null;

    for (let i = 0; i < NOMBRE_ARRETES_ESSAYES; i++) {
      const debut = anneeArrete - i;
      try {
        return await this.zoneDuJeuDeDonnees(`${debut}_${debut + 1}`, point);
      } catch (erreur) {
        derniereErreur = erreur;
      }
    }

    throw derniereErreur instanceof Error
      ? derniereErreur
      : new Error('aucun jeu de données disponible');
  }

  private async zoneDuJeuDeDonnees(
    millesime: string,
    point: { lat: number; lon: number },
  ): Promise<ValeursZone | null> {
    const url = new URL(this.wfsUrl);
    url.searchParams.set('SERVICE', 'WFS');
    url.searchParams.set('VERSION', '2.0.0');
    url.searchParams.set('request', 'GetFeature');
    url.searchParams.set(
      'typename',
      `metropole-de-lyon:car_care.carencadrmtloyer_${millesime}`,
    );
    url.searchParams.set('outputFormat', 'application/json');
    url.searchParams.set('propertyName', 'zonage,valeurs');
    // En WFS 2.0 avec EPSG:4326, l'ordre des axes est latitude puis longitude.
    url.searchParams.set(
      'CQL_FILTER',
      `INTERSECTS(the_geom,POINT(${point.lat} ${point.lon}))`,
    );

    const reponse = await this.requeter(url);
    const corps = (await reponse.json()) as {
      features?: { properties: { valeurs: string | ValeursZone } }[];
    };

    const valeurs = corps.features?.[0]?.properties.valeurs;
    if (valeurs === undefined) {
      return null;
    }

    return typeof valeurs === 'string'
      ? (JSON.parse(valeurs) as ValeursZone)
      : valeurs;
  }

  private async requeter(url: URL): Promise<Response> {
    const reponse = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(DELAI_REQUETE_MS),
    });

    if (!reponse.ok) {
      throw new Error(
        `HTTP ${reponse.status} sur ${url.origin}${url.pathname}`,
      );
    }

    return reponse;
  }
}
