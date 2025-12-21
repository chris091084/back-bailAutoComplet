package Back.bailAutoComplet.BailAutoComplet.model;


import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.List;

@Entity
@Table(name = "appartement")
public class Appartement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @ManyToOne()
    @JoinColumn(name = "bailleur_id", nullable = false)
    private Bailleur bailleur;

    @Column(nullable = false)
    private String adress;

    @OneToMany(mappedBy = "appartement", cascade = CascadeType.ALL, orphanRemoval = true)
    @Column(name = "chambre")
    private List<Chambre> chambres;

    @OneToMany(mappedBy = "appartement", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Caracteristique> caracteristiques;

    @Column(name = "energieHeating", nullable = false)
    private String energieHeating;

    @Column(name = "energieWater", nullable = false)
    private String energieWater;

    @Column(name = "chauffage_collectif", nullable = false)
    private Boolean chauffageCollectif;

    @Column(name = "bank_name", columnDefinition = "TEXT")
    private String bankName;

    @Column(columnDefinition = "TEXT")
    private String restrictions;

    @Column(name = "construction_period")
    private String constructionPeriod;

    @Column(name = "surface")
    private BigDecimal surface;

    @Column(name = "charges")
    private BigDecimal charges;

    @Column(name = "loyers")
    private BigDecimal loyers;

    @Column(name = "caution")
    private BigDecimal caution;

    @Column(name = "pet_rule")
    private String petRule;

    @Column(name = "rent_ref")
    private BigDecimal rentRef;

    @Column(name = "rent_ref_maj")
    private BigDecimal rentRefMaj;

    @Column(name = "val_Irl")
    private String valIrl;

    @Column(name = "t_irl")
    private String tIrl;

    @Column(name = "form_name")
    private String formName;

    public Appartement() {
    }

    public Appartement(
            String name,
            Bailleur bailleur,
            String adress,
            List<Chambre> chambres,
            List<Caracteristique> caracteristiques,
            String energieHeating,
            String energieWater,
            Boolean chauffageCollectif,
            String bankName,
            String restrictions,
            String constructionPeriod,
            BigDecimal surface,
            BigDecimal charges,
            BigDecimal loyers,
            BigDecimal caution,
            String petRule,
            BigDecimal rentRef,
            BigDecimal rentRefMaj,
            String valIrl,
            String tIrl,
            String formName

    ) {
        this.name = name;
        this.bailleur = bailleur;
        this.adress = adress;
        this.chambres = chambres;
        this.caracteristiques = caracteristiques;
        this.energieHeating = energieHeating;
        this.energieWater = energieWater;
        this.chauffageCollectif = chauffageCollectif;
        this.bankName = bankName;
        this.restrictions = restrictions;
        this.constructionPeriod = constructionPeriod;
        this.surface = surface;
        this.charges = charges;
        this.loyers = loyers;
        this.caution = caution;
        this.rentRef = rentRef;
        this.rentRefMaj = rentRefMaj;
        this.petRule = petRule;
        this.valIrl = valIrl;
        this.tIrl = tIrl;
        this.formName = formName;
    }

    // Getters et Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setNom(String nom) {
        this.name = name;
    }

    public Bailleur getBailleur() {
        return bailleur;
    }

    public void setBailleur(Bailleur bailleur) {
        this.bailleur = bailleur;
    }

    public String getAdress() {
        return adress;
    }

    public void setAdress(String adress) {
        this.adress = adress;
    }

    public List<Chambre> getChambres() {
        return chambres;
    }

    public void setChambres(List<Chambre> chambres) {
        this.chambres = chambres;
    }

    public List<Caracteristique> getCaracteristiques() {
        return caracteristiques;
    }

    public void setCaracteristiques(List<Caracteristique> caracteristiques) {
        this.caracteristiques = caracteristiques;
    }

    public String getEnergieHeating() {
        return energieHeating;
    }

    public void setEnergieHeating(String energieHeating) {
        this.energieHeating = energieHeating;
    }

    public String getEnergieWater() {
        return energieWater;
    }

    public void setEnergieWater(String energieWater) {
        this.energieWater = energieWater;
    }

    public Boolean getChauffageCollectif() {
        return chauffageCollectif;
    }

    public void setChauffageCollectif(Boolean chauffageCollectif) {
        this.chauffageCollectif = chauffageCollectif;
    }

    public String getBankName() {
        return bankName;
    }

    public void setBankName(String bankName) {
        this.bankName = bankName;
    }

    public String getRestrictions() {
        return restrictions;
    }

    public void setRestrictions(String restrictions) {
        this.restrictions = restrictions;
    }

    public String getConstructionPeriod() {
        return constructionPeriod;
    }

    public void setAnneeConstruction(String anneeConstruction) {
        this.constructionPeriod = anneeConstruction;
    }

    public BigDecimal getSurface() {
        return surface;
    }

    public void setSurface(BigDecimal surface) {
        this.surface = surface;
    }

    public BigDecimal getCharges() {
        return charges;
    }

    public void setCharges(BigDecimal charges) {
        this.charges = charges;
    }

    public BigDecimal getLoyers() {
        return loyers;
    }

    public void setLoyers(BigDecimal loyers) {
        this.loyers = loyers;
    }

    public BigDecimal getCaution() {
        return caution;
    }

    public void setCaution(BigDecimal caution) {
        this.caution = caution;
    }

    public String getPetRule() {
        return petRule;
    }

    public void setPetRule(String petRule) {
        this.petRule = petRule;
    }

    public BigDecimal getRentRef() {
        return rentRef;
    }

    public void setRentRef(BigDecimal rentRef) {
        this.rentRef = rentRef;
    }

    public BigDecimal getRentRefMaj() {
        return rentRefMaj;
    }

    public void setRentRefMaj(BigDecimal rentRefMaj) {
        this.rentRefMaj = rentRefMaj;
    }

    public String getValIrl() {
        return valIrl;
    }

    public void setValIrl(String valIrl) {
        this.valIrl = valIrl;
    }

    public String gettIrl() {
        return tIrl;
    }

    public void settIrl(String tIrl) {
        this.tIrl = tIrl;
    }

    public String getFormName() {
        return formName;
    }

    public void setFormName(String formName) {
        this.formName = formName;
    }
}
