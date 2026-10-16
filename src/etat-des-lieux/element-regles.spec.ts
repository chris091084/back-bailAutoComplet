import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ModifierElementDto } from './dto/modifier-element.dto';
import { EdlElement } from './edl-element.entity';
import { StatutValidation } from './etat-des-lieux.enums';
import { EtatElement } from './etat-element.enum';
import {
  CODE_VERSION_PLUS_RECENTE,
  appliquerModification,
  elementsNonTraites,
} from './element-regles';

const MAINTENANT = new Date('2026-10-15T12:00:00.000Z');

const creerElement = (surcharge: Partial<EdlElement> = {}): EdlElement =>
  ({
    id: 'el-1',
    nom: 'Murs',
    ordre: 0,
    etatBailleur: EtatElement.BON,
    commentaireBailleur: null,
    etatLocataire: null,
    commentaireLocataire: null,
    dateModifLocataire: null,
    statutValidation: StatutValidation.A_VERIFIER,
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...surcharge,
  }) as EdlElement;

const requete = (dto: Partial<ModifierElementDto>): ModifierElementDto =>
  ({ modifieLe: '2026-10-15T11:59:00.000Z', ...dto }) as ModifierElementDto;

describe('appliquerModification', () => {
  it('valide en un clic avec la référence du bailleur', () => {
    const element = creerElement();

    const resultat = appliquerModification(
      element,
      requete({ statutValidation: StatutValidation.VALIDE }),
      MAINTENANT,
    );

    expect(resultat.modifie).toBe(true);
    expect(element.statutValidation).toBe(StatutValidation.VALIDE);
    // La coche n'invente pas de saisie du locataire.
    expect(element.etatLocataire).toBeNull();
  });

  it('enregistre état et commentaire, et horodate avec l’instant du client', () => {
    const element = creerElement();

    appliquerModification(
      element,
      requete({
        etatLocataire: EtatElement.MOYEN,
        commentaireLocataire: '  Tache au mur  ',
        statutValidation: StatutValidation.VALIDE,
      }),
      MAINTENANT,
    );

    expect(element.etatLocataire).toBe(EtatElement.MOYEN);
    expect(element.commentaireLocataire).toBe('Tache au mur');
    expect(element.dateModifLocataire).toEqual(
      new Date('2026-10-15T11:59:00.000Z'),
    );
    expect(element.updatedAt).toEqual(MAINTENANT);
  });

  it('refuse de valider un élément sans aucun état (entrée sans référence)', () => {
    const element = creerElement({ etatBailleur: null });

    expect(() =>
      appliquerModification(
        element,
        requete({ statutValidation: StatutValidation.VALIDE }),
        MAINTENANT,
      ),
    ).toThrow(UnprocessableEntityException);
    expect(element.statutValidation).toBe(StatutValidation.A_VERIFIER);
  });

  it('accepte de valider une entrée dès que le locataire a choisi un état', () => {
    const element = creerElement({ etatBailleur: null });

    appliquerModification(
      element,
      requete({
        etatLocataire: EtatElement.NEUF,
        statutValidation: StatutValidation.VALIDE,
      }),
      MAINTENANT,
    );

    expect(element.statutValidation).toBe(StatutValidation.VALIDE);
  });

  it('est idempotent : rejouer la même requête ne change rien', () => {
    const element = creerElement();
    const dto = requete({
      etatLocataire: EtatElement.MAUVAIS,
      statutValidation: StatutValidation.VALIDE,
    });

    appliquerModification(element, dto, MAINTENANT);
    const miseAJour = element.updatedAt;
    const rejeu = appliquerModification(
      element,
      dto,
      new Date(MAINTENANT.getTime() + 60_000),
    );

    expect(rejeu.modifie).toBe(false);
    expect(element.updatedAt).toBe(miseAJour);
  });

  it('refuse une écriture plus ancienne que celle du serveur (409)', () => {
    const element = creerElement({
      etatLocataire: EtatElement.BON,
      dateModifLocataire: new Date('2026-10-15T11:58:00.000Z'),
    });

    let erreur: unknown;
    try {
      appliquerModification(
        element,
        requete({
          etatLocataire: EtatElement.MAUVAIS,
          modifieLe: '2026-10-15T11:50:00.000Z',
        }),
        MAINTENANT,
      );
    } catch (e) {
      erreur = e;
    }

    expect(erreur).toBeInstanceOf(ConflictException);
    expect((erreur as ConflictException).getResponse()).toMatchObject({
      code: CODE_VERSION_PLUS_RECENTE,
    });
    expect(element.etatLocataire).toBe(EtatElement.BON);
  });

  it('accepte une écriture plus récente que celle du serveur', () => {
    const element = creerElement({
      etatLocataire: EtatElement.BON,
      dateModifLocataire: new Date('2026-10-15T11:00:00.000Z'),
    });

    appliquerModification(
      element,
      requete({ etatLocataire: EtatElement.MAUVAIS }),
      MAINTENANT,
    );

    expect(element.etatLocataire).toBe(EtatElement.MAUVAIS);
  });

  it('ramène à l’heure du serveur un horodatage lointain dans le futur', () => {
    const element = creerElement();

    appliquerModification(
      element,
      requete({
        etatLocataire: EtatElement.BON,
        modifieLe: '2030-01-01T00:00:00.000Z',
      }),
      MAINTENANT,
    );

    expect(element.dateModifLocataire!.getTime()).toBeLessThanOrEqual(
      MAINTENANT.getTime() + 5 * 60 * 1000,
    );
  });

  it('efface un commentaire avec null ou une chaîne blanche', () => {
    const element = creerElement({ commentaireLocataire: 'Rayure' });

    appliquerModification(
      element,
      requete({ commentaireLocataire: '   ' }),
      MAINTENANT,
    );

    expect(element.commentaireLocataire).toBeNull();
  });

  it('rejette une requête qui ne demande rien', () => {
    expect(() =>
      appliquerModification(creerElement(), requete({}), MAINTENANT),
    ).toThrow(UnprocessableEntityException);
  });
});

describe('elementsNonTraites', () => {
  it('ne garde que les éléments pas encore validés', () => {
    const elements = [
      creerElement({ id: 'a', statutValidation: StatutValidation.VALIDE }),
      creerElement({ id: 'b' }),
    ];

    expect(elementsNonTraites(elements).map((e) => e.id)).toEqual(['b']);
  });
});
