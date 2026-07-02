package Back.bailAutoComplet.BailAutoComplet.Dto;

/**
 * Valeur de l'IRL récupérée depuis l'INSEE.
 *
 * @param valIrl valeur de l'indice (ex. "146.6")
 * @param tIrl   libellé du trimestre correspondant (ex. "T1 2026")
 */
public record IrlDto(String valIrl, String tIrl) {
}
