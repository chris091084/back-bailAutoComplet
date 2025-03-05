package Back.bailAutoComplet.BailAutoComplet.Dto;

import Back.bailAutoComplet.BailAutoComplet.model.Appartement;
import Back.bailAutoComplet.BailAutoComplet.model.Chambre;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

public class AppartementDto {
    private Long id;
    private String name;
    private String adress;
    private List<Chambre> chambres;
    private List<CaracteristiqueDto> caracteristiques; // Utilise CaracteristiqueDTO
    private String typeChauffage;
    private Boolean chauffageCollectif;
    private String bankName;
    private String restrictions;
    private String constructionPeriod;
    private BigDecimal surface;
    private BigDecimal charges;
    private BigDecimal loyers;
    private BigDecimal caution;

    // Constructeur prenant un objet Appartement comme source
    public AppartementDto(Appartement appartement) {
        this.id = appartement.getId();
        this.name = appartement.getName();
        this.adress = appartement.getAdresse();
        this.chambres = appartement.getChambres();
        this.caracteristiques = appartement.getCaracteristiques()
                .stream()
                .map(CaracteristiqueDto::new) // Transforme Caracteristique en CaracteristiqueDTO
                .collect(Collectors.toList());
        this.typeChauffage = appartement.getTypeChauffage();
        this.chauffageCollectif = appartement.getChauffageCollectif();
        this.bankName = appartement.getBankName();
        this.restrictions = appartement.getRestrictions();
        this.constructionPeriod = appartement.getConstructionPeriod();
        this.surface = appartement.getSurface();
        this.charges = appartement.getCharges();
        this.loyers = appartement.getLoyers();
        this.caution = appartement.getCaution();
    }

    // Getters
    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getAdress() {
        return adress;
    }

    public List<Chambre> getChambres() {
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

    public String getBankName() {
        return bankName;
    }

    public String getRestrictions() {
        return restrictions;
    }

    public String getConstructionPeriod() {
        return constructionPeriod;
    }

    public BigDecimal getSuperficie() {
        return surface;
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
