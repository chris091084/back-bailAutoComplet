import { OneDriveIndisponibleError } from '../src/onedrive/onedrive.errors';

/**
 * OneDrive de pacotille pour les tests e2e : les fichiers vivent en mémoire, et
 * `panne` simule les refus de Microsoft. Le vrai service est testé, avec un
 * `fetch` simulé, dans `onedrive.service.spec.ts`.
 */
export class OneDriveFaux {
  readonly fichiers = new Map<
    string,
    { chemin: string; contenu: Buffer; mime: string }
  >();
  /** Si défini, chaque appel échoue comme le ferait Microsoft. */
  panne: OneDriveIndisponibleError | null = null;
  private compteur = 0;

  async televerser(chemin: string, contenu: Buffer, mime: string) {
    if (this.panne) {
      throw this.panne;
    }
    const itemId = `ITEM-${++this.compteur}`;
    this.fichiers.set(itemId, { chemin, contenu, mime });
    return { itemId, webUrl: `https://onedrive.test/${itemId}` };
  }

  async telecharger(itemId: string): Promise<Buffer> {
    if (this.panne) {
      throw this.panne;
    }
    const fichier = this.fichiers.get(itemId);
    if (!fichier) {
      throw new OneDriveIndisponibleError('INDISPONIBLE', 'absent');
    }
    return fichier.contenu;
  }

  async supprimer(itemId: string): Promise<void> {
    if (this.panne) {
      throw this.panne;
    }
    this.fichiers.delete(itemId);
  }
}
