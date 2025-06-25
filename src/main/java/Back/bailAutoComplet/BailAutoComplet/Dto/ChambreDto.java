package Back.bailAutoComplet.BailAutoComplet.Dto;

import Back.bailAutoComplet.BailAutoComplet.model.Chambre;

public class ChambreDto {

    private Long id;
    private String piece;

    public ChambreDto(Chambre chambre) {
        this.id = chambre.getId();
        this.piece = chambre.getPiece();
    }

    public Long getId() {
        return id;
    }

    public String getPiece() {
        return piece;
    }
}
