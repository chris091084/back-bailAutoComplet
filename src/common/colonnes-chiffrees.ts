/**
 * Les colonnes chiffrées, telles que la base les connaît (noms SQL). Utilisée par
 * le script de reprise `chiffrer-donnees.ts` ; un test vérifie qu'elle correspond
 * exactement aux colonnes déclarées avec `encryptedTransformer` dans les entités.
 *
 * Volontairement HORS de cette liste : ce que le code trie, filtre ou purge
 * (`etat`, `entree`, `sortie`, `conservation_prolongee`, dates et montants du
 * bail, chambre) et les données du bailleur.
 */
export const COLONNES_CHIFFREES: { table: string; colonnes: string[] }[] = [
  {
    table: 'locataire',
    colonnes: [
      'nom',
      'prenom',
      'telephone',
      'email',
      'date_naissance',
      'profession',
    ],
  },
  {
    table: 'result_form',
    colonnes: ['adress', 'email', 'firstname', 'motif', 'name', 'telephone'],
  },
  { table: 'generation', colonnes: ['locataire_name'] },
];
