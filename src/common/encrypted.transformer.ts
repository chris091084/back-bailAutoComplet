import { ValueTransformer } from 'typeorm';
import { chiffrer, dechiffrer } from './encryption';

/**
 * Chiffre à l'écriture, déchiffre à la lecture : la colonne ne contient jamais la
 * donnée en clair, le reste du code ne voit que du texte ordinaire.
 *
 * À réserver aux colonnes que rien ne filtre ni ne trie en SQL (voir
 * `colonnes-chiffrees.ts`). Toute valeur qui n'est pas une chaîne (un opérateur
 * de recherche TypeORM par exemple) passe sans être touchée.
 */
export const encryptedTransformer: ValueTransformer = {
  to: (valeur?: unknown) =>
    typeof valeur === 'string' ? chiffrer(valeur) : valeur,
  from: (valeur?: unknown) =>
    typeof valeur === 'string' ? dechiffrer(valeur) : valeur,
};
