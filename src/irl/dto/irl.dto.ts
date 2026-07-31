/**
 * Valeur de l'IRL récupérée depuis l'INSEE.
 *
 * - `valIrl` : valeur de l'indice (ex. « 146.6 »)
 * - `tIrl`   : libellé du trimestre correspondant (ex. « T1 2026 »)
 */
export interface IrlDto {
  valIrl: string;
  tIrl: string;
}
