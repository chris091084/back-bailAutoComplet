import { PieceModeleDto } from './dto/create-etat-des-lieux.dto';

/**
 * Pièces et éléments proposés quand le bailleur ne précise rien à la création
 * d'un état d'ENTRÉE. Reprend l'exemple du formulaire Word (une chambre) ; à
 * compléter avec les autres pièces du modèle d'origine.
 */
export const PIECES_PAR_DEFAUT: PieceModeleDto[] = [
  {
    nom: 'Chambre',
    elements: [
      { nom: 'Murs' },
      { nom: 'Sols' },
      { nom: 'Plafond' },
      { nom: 'Fenêtres' },
      { nom: 'Électricité' },
      { nom: 'Bureau' },
    ],
  },
];
