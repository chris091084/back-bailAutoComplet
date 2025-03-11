package Back.bailAutoComplet.BailAutoComplet.Dto;

import Back.bailAutoComplet.BailAutoComplet.model.Caracteristique;

public class CaracteristiqueDto {

    private Long id;
    private String description;
    private Long appartementId;

    public CaracteristiqueDto(Caracteristique caracteristique) {
        this.id = caracteristique.getId();
        this.description = caracteristique.getDescription();
        this.appartementId = caracteristique.getAppartement() != null ? caracteristique.getAppartement().getId() : null;
    }

    // Getters
    public Long getId() { return id; }
    public String getDescription() { return description; }
    public Long getAppartementId() { return appartementId; }
}
