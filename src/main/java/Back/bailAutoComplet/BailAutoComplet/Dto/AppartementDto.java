package Back.bailAutoComplet.BailAutoComplet.Dto;

import Back.bailAutoComplet.BailAutoComplet.model.Appartement;
import Back.bailAutoComplet.BailAutoComplet.model.Bailleur;
import Back.bailAutoComplet.BailAutoComplet.model.Caracteristique;
import jakarta.persistence.Column;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

public class AppartementDto {
    private Long id;
    private String name;
    private String adress;
    private Bailleur bailleur;
    private List<ChambreDto> chambres;
    private List<String> caracteristiques; // Utilise CaracteristiqueDTO
    private String energieHeating;
    private String energieWater;
    private Boolean chauffageCollectif;
    private String bankName;
    private String restrictions;
    private String constructionPeriod;
    private BigDecimal surface;
    private BigDecimal charges;
    private BigDecimal loyers;
    private BigDecimal caution;
    private String petRule;
    private BigDecimal rentRef;
    private BigDecimal rentRefMaj;
    private String valIrl;
    private String tIrl;

    // Constructeur prenant un objet Appartement comme source
    public AppartementDto(Appartement appartement) {
        this.id = appartement.getId();
        this.name = appartement.getName();
        this.adress = appartement.getAdress();
        this.bailleur = appartement.getBailleur();
        this.chambres = appartement.getChambres().stream().map(ChambreDto::new).collect(Collectors.toList());
        this.caracteristiques = appartement.getCaracteristiques()
                .stream()
                .map(Caracteristique::getDescription).collect(Collectors.toList());
        this.energieHeating = appartement.getEnergieHeating();
        this.energieWater = appartement.getEnergieWater();
        this.chauffageCollectif = appartement.getChauffageCollectif();
        this.bankName = appartement.getBankName();
        this.restrictions = appartement.getRestrictions();
        this.constructionPeriod = appartement.getConstructionPeriod();
        this.surface = appartement.getSurface();
        this.charges = appartement.getCharges();
        this.loyers = appartement.getLoyers();
        this.caution = appartement.getCaution();
        this.petRule = appartement.getPetRule();
        this.rentRef = appartement.getRentRef();
        this.rentRefMaj = appartement.getRentRefMaj();
        this.valIrl = appartement.getValIrl();
        this.tIrl = appartement.gettIrl();

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

    public Bailleur getBailleur() { return bailleur; }

    public List<ChambreDto> getChambres() {
        return chambres;
    }

    public List<String> getCaracteristiques() {
        return caracteristiques;
    }

    public String getEnergieHeating() {
        return energieHeating;
    }

    public String getEnergieWater() {
        return energieWater;
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

    public BigDecimal getSurface() {
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

    public String getPetRule() {
        return petRule;
    }

    public BigDecimal getRentRef() {
        return rentRef;
    }

    public BigDecimal getRentRefMaj() {
        return rentRefMaj;
    }

    public String getValIrl() {
        return valIrl;
    }

    public String gettIrl() {
        return tIrl;
    }
}
