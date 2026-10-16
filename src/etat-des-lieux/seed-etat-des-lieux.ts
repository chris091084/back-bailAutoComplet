import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import dataSource from '../database/data-source';
import { Locataire } from '../locataire/locataire.entity';
import { EdlElement } from './edl-element.entity';
import { EdlPiece } from './edl-piece.entity';
import { EtatDesLieux } from './etat-des-lieux.entity';
import {
  StatutEtatDesLieux,
  StatutValidation,
  TypeEtatDesLieux,
} from './etat-des-lieux.enums';
import { EtatElement } from './etat-element.enum';

/**
 * Sème un état des lieux d'ENTRÉE signé (« Chambre 4 : Murs, Sols, Plafond,
 * Fenêtres, Électricité, Bureau »), pour pouvoir tester le flux de SORTIE : la
 * sortie en reprend les valeurs comme référence bailleur.
 *
 *     npm run edl:seed                    # dernier locataire créé
 *     npm run edl:seed -- --locataire=12  # un locataire précis
 *
 * Sans effet si ce locataire a déjà un état d'entrée signé. Données de
 * démonstration : à ne pas lancer sur la base de production.
 */
const ELEMENTS: {
  nom: string;
  etat: EtatElement;
  commentaire: string | null;
  /** Saisie du locataire qui a corrigé le bailleur à l'entrée, le cas échéant. */
  locataire?: { etat: EtatElement; commentaire: string };
}[] = [
  {
    nom: 'Murs',
    etat: EtatElement.BON,
    commentaire: 'Peinture blanche récente',
  },
  {
    nom: 'Sols',
    etat: EtatElement.BON,
    commentaire: null,
    locataire: {
      etat: EtatElement.MOYEN,
      commentaire: 'Rayure près du bureau',
    },
  },
  { nom: 'Plafond', etat: EtatElement.TRES_BON, commentaire: null },
  { nom: 'Fenêtres', etat: EtatElement.BON, commentaire: 'Double vitrage' },
  {
    nom: 'Électricité',
    etat: EtatElement.BON,
    commentaire: '2 prises, 1 interrupteur',
  },
  { nom: 'Bureau', etat: EtatElement.NEUF, commentaire: null },
];

const idArgument = (): number | null => {
  const argument = process.argv.find((a) => a.startsWith('--locataire='));
  return argument ? Number(argument.split('=')[1]) : null;
};

async function main(): Promise<void> {
  await dataSource.initialize();

  try {
    const locataires = dataSource.getRepository(Locataire);
    const id = idArgument();
    const locataire = id
      ? await locataires.findOne({
          where: { id },
          relations: { appartement: true },
        })
      : await locataires.findOne({
          where: {},
          order: { id: 'DESC' },
          relations: { appartement: true },
        });

    if (!locataire) {
      throw new Error(
        'Aucun locataire trouvé : créez-en un depuis l’application, ou passez --locataire=<id>.',
      );
    }

    const repository = dataSource.getRepository(EtatDesLieux);
    const existant = await repository.findOneBy({
      locataireId: locataire.id,
      type: TypeEtatDesLieux.ENTREE,
      statut: StatutEtatDesLieux.SIGNED,
    });
    if (existant) {
      console.log(
        `\n  Le locataire ${locataire.id} a déjà un état d'entrée signé (${existant.id}) : rien à semer.\n`,
      );
      return;
    }

    const maintenant = new Date();
    const edl = repository.create({
      type: TypeEtatDesLieux.ENTREE,
      statut: StatutEtatDesLieux.SIGNED,
      appartementId: locataire.appartement.id,
      locataireId: locataire.id,
      etatEntreeRefId: null,
      dateSignature: maintenant,
      adresse: locataire.appartement.adress,
      chauffage: `${locataire.appartement.energieHeating} (démo)`,
      clesRemises: '2 clés + 1 badge (démo)',
      lienJti: randomUUID(),
      // Document déjà signé : son lien n'a plus d'usage.
      lienExpireLe: maintenant,
      pieces: [
        {
          nom: 'Chambre 4',
          ordre: 0,
          elements: ELEMENTS.map((e, ordre) => ({
            nom: e.nom,
            ordre,
            etatBailleur: e.etat,
            commentaireBailleur: e.commentaire,
            etatLocataire: e.locataire?.etat ?? null,
            commentaireLocataire: e.locataire?.commentaire ?? null,
            dateModifLocataire: e.locataire ? maintenant : null,
            statutValidation: StatutValidation.VALIDE,
          })) as EdlElement[],
        } as EdlPiece,
      ],
    });

    const enregistre = await repository.save(edl);
    console.log(
      `\n  État d'entrée de démonstration créé (${enregistre.id}) pour le locataire ${locataire.id}.\n` +
        `  Pour tester la sortie : POST /etats-des-lieux {"locataireId": ${locataire.id}, "type": "sortie"}\n`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
