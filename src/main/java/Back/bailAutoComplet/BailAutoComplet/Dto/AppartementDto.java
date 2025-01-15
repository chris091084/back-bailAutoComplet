package Back.bailAutoComplet.BailAutoComplet.Dto;

import Back.bailAutoComplet.BailAutoComplet.model.Appartement;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

public class AppartementDto {
    private Long id;
    private String nom;
    private String adresse;
    private List<String> chambres;
    private List<CaracteristiqueDto> caracteristiques; // Utilise CaracteristiqueDTO
    private String typeChauffage;
    private Boolean chauffageCollectif;
    private String informationsBancaires;
    private String restrictions;
    private String anneeConstruction;
    private BigDecimal superficie;
    private BigDecimal charges;
    private BigDecimal loyers;
    private BigDecimal caution;

    // Constructeur prenant un objet Appartement comme source
    public void AppartementDTO(Appartement appartement) {
        this.id = appartement.getId();
        this.nom = appartement.getNom();
        this.adresse = appartement.getAdresse();
        this.chambres = appartement.getChambres();
        this.caracteristiques = appartement.getCaracteristiques()
                .stream()
                .map(CaracteristiqueDto::new) // Transforme Caracteristique en CaracteristiqueDTO
                .collect(Collectors.toList());
        this.typeChauffage = appartement.getTypeChauffage();
        this.chauffageCollectif = appartement.getChauffageCollectif();
        this.informationsBancaires = appartement.getInformationsBancaires();
        this.restrictions = appartement.getRestrictions();
        this.anneeConstruction = appartement.getAnneeConstruction();
        this.superficie = appartement.getSuperficie();
        this.charges = appartement.getCharges();
        this.loyers = appartement.getLoyers();
        this.caution = appartement.getCaution();
    }

    // Getters
    public Long getId() {
        return id;
    }

    public String getNom() {
        return nom;
    }

    public String getAdresse() {
        return adresse;
    }

    public List<String> getChambres() {
        return chambres;
    }

    public List<CaracteristiqueDto> getCaracteristiques() {
        return caracteristiques;
    }

    public String getTypeChauffage() {
        return typeChauffage;
    }

    public Boolean getChauffageCollectif() {
        return chauffageCollectif;
    }

    public String getInformationsBancaires() {
        return informationsBancaires;
    }

    public String getRestrictions() {
        return restrictions;
    }

    public String getAnneeConstruction() {
        return anneeConstruction;
    }

    public BigDecimal getSuperficie() {
        return superficie;
    }

    public BigDecimal getCharges() {
        return charges;
    }

    public BigDecimal getLoyers() {
        return loyers;
    }

    public BigDecimal getCaution() {
        return caution;
    }
}
