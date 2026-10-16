import { Injectable, Logger } from '@nestjs/common';
import { OneDriveAuthService, lireRetryAfter } from './onedrive-auth.service';
import { encoderChemin } from './onedrive-chemin';
import { URL_GRAPH } from './onedrive.config';
import { OneDriveIndisponibleError } from './onedrive.errors';
import { FichierOneDrive } from './onedrive.types';

/** Au-delà, `PUT …/content` est refusé par Graph : il faut une session de téléversement. */
export const SEUIL_SESSION_OCTETS = 4 * 1024 * 1024;
/** Les morceaux d'une session doivent être un multiple de 320 Kio. */
export const TAILLE_MORCEAU = 12 * 320 * 1024;
const DELAI_REQUETE_MS = 30_000;

interface ElementDrive {
  id?: string;
  webUrl?: string;
}

/**
 * Fichiers dans le dossier applicatif du OneDrive du bailleur (Microsoft Graph).
 * Tout passe par `/me/drive/special/approot` : jamais en dehors de ce dossier,
 * quoi qu'on demande, puisque c'est tout ce que le scope autorise.
 *
 * Aucune dépendance (SDK Azure/MSAL) : trois appels REST suffisent, et `fetch`
 * est natif dans Node 20.
 */
@Injectable()
export class OneDriveService {
  private readonly logger = new Logger('OneDrive');

  constructor(private readonly auth: OneDriveAuthService) {}

  /** Envoie un fichier au chemin donné (dossiers intermédiaires créés au besoin). */
  async televerser(
    chemin: string,
    contenu: Buffer,
    typeMime: string,
  ): Promise<FichierOneDrive> {
    const racine = `${URL_GRAPH}/me/drive/special/approot:/${encoderChemin(chemin)}:`;
    const element =
      contenu.length <= SEUIL_SESSION_OCTETS
        ? await this.televerserSimple(racine, contenu, typeMime)
        : await this.televerserParSession(racine, contenu);

    if (!element.id) {
      throw new OneDriveIndisponibleError(
        'INDISPONIBLE',
        "OneDrive n'a pas renvoyé d'identifiant de fichier.",
      );
    }

    return { itemId: element.id, webUrl: element.webUrl ?? '' };
  }

  /** Contenu d'un fichier (Graph répond par une redirection, suivie par `fetch`). */
  async telecharger(itemId: string): Promise<Buffer> {
    const reponse = await this.graph(
      'GET',
      `${URL_GRAPH}/me/drive/items/${encodeURIComponent(itemId)}/content`,
    );
    return Buffer.from(await reponse.arrayBuffer());
  }

  /** Supprime un fichier. Un fichier déjà absent (404) compte comme supprimé. */
  async supprimer(itemId: string): Promise<void> {
    await this.graph(
      'DELETE',
      `${URL_GRAPH}/me/drive/items/${encodeURIComponent(itemId)}`,
      undefined,
      undefined,
      [404],
    );
  }

  // ----------------------------------------------------------------- interne

  private async televerserSimple(
    racine: string,
    contenu: Buffer,
    typeMime: string,
  ): Promise<ElementDrive> {
    const reponse = await this.graph(
      'PUT',
      `${racine}/content?@microsoft.graph.conflictBehavior=rename`,
      contenu,
      { 'content-type': typeMime },
    );
    return (await reponse.json()) as ElementDrive;
  }

  /**
   * Fichiers de plus de 4 Mo : on ouvre une session, puis on envoie par
   * morceaux. L'URL de session est pré-autorisée : on n'y joint PAS le jeton.
   */
  private async televerserParSession(
    racine: string,
    contenu: Buffer,
  ): Promise<ElementDrive> {
    const session = await this.graph(
      'POST',
      `${racine}/createUploadSession`,
      JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename' },
      }),
      { 'content-type': 'application/json' },
    );
    const { uploadUrl } = (await session.json()) as { uploadUrl?: string };
    if (!uploadUrl) {
      throw new OneDriveIndisponibleError(
        'INDISPONIBLE',
        "OneDrive n'a pas ouvert de session de téléversement.",
      );
    }

    let derniere: Response | null = null;
    for (let debut = 0; debut < contenu.length; debut += TAILLE_MORCEAU) {
      const fin = Math.min(debut + TAILLE_MORCEAU, contenu.length) - 1;
      derniere = await this.appeler(
        'PUT',
        uploadUrl,
        contenu.subarray(debut, fin + 1),
        {
          'content-range': `bytes ${debut}-${fin}/${contenu.length}`,
        },
      );

      if (!derniere.ok && derniere.status !== 202) {
        // Session abandonnée : on ne laisse pas un fichier à moitié reçu.
        await this.appeler('DELETE', uploadUrl).catch(() => undefined);
        throw this.versErreur(derniere);
      }
    }

    return (await derniere?.json()) as ElementDrive;
  }

  /** Appel Graph authentifié. Renouvelle une fois le jeton si Graph le refuse (401). */
  private async graph(
    methode: string,
    url: string,
    corps?: Buffer | string,
    entetes: Record<string, string> = {},
    statutsAcceptes: number[] = [],
  ): Promise<Response> {
    for (let essai = 1; ; essai++) {
      const jeton = await this.auth.accessToken();
      const reponse = await this.appeler(methode, url, corps, {
        ...entetes,
        authorization: `Bearer ${jeton}`,
      });

      if (reponse.status === 401 && essai === 1) {
        this.auth.invalider();
        continue;
      }
      if (reponse.ok || statutsAcceptes.includes(reponse.status)) {
        return reponse;
      }
      throw this.versErreur(reponse);
    }
  }

  private async appeler(
    methode: string,
    url: string,
    corps?: Buffer | string,
    entetes: Record<string, string> = {},
  ): Promise<Response> {
    try {
      return await fetch(url, {
        method: methode,
        headers: entetes,
        body: corps as BodyInit | undefined,
        signal: AbortSignal.timeout(DELAI_REQUETE_MS),
      });
    } catch {
      throw new OneDriveIndisponibleError(
        'INDISPONIBLE',
        'OneDrive est injoignable.',
      );
    }
  }

  private versErreur(reponse: Response): OneDriveIndisponibleError {
    const retryAfter = lireRetryAfter(reponse);
    this.logger.warn(`OneDrive a répondu ${reponse.status}`);

    if (reponse.status === 429) {
      return new OneDriveIndisponibleError(
        'LIMITE',
        'OneDrive limite temporairement les requêtes.',
        retryAfter,
      );
    }
    if (reponse.status === 507) {
      return new OneDriveIndisponibleError('QUOTA', 'Le OneDrive est plein.');
    }
    if (reponse.status === 401 || reponse.status === 403) {
      return new OneDriveIndisponibleError(
        'REVOQUE',
        "L'accès à OneDrive a été refusé : reconnectez-le.",
      );
    }
    return new OneDriveIndisponibleError(
      'INDISPONIBLE',
      `OneDrive a répondu ${reponse.status}.`,
      retryAfter,
    );
  }
}
