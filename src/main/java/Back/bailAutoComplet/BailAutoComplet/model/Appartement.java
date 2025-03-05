package Back.bailAutoComplet.BailAutoComplet.model;


import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.List;

@Entity
@Table(name = "appartements")
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

    @Column(name = "type_chauffage", nullable = false)
    private String typeChauffage;

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

    // Constructeurs
    public Appartement() {
    }

    public Appartement(
            String name,
            Bailleur bailleur,
            String adress,
            List<Chambre> chambres,
            List<Caracteristique> caracteristiques,
            String typeChauffage,
            Boolean chauffageCollectif,
            String bankName,
            String restrictions,
            String constructionPeriod,
            BigDecimal superficie,
            BigDecimal charges,
            BigDecimal loyers,
            BigDecimal caution
    ) {
        this.name = name;
        this.bailleur = bailleur;
        this.adress = adress;
        this.chambres = chambres;
        this.caracteristiques = caracteristiques;
        this.typeChauffage = typeChauffage;
        this.chauffageCollectif = chauffageCollectif;
        this.bankName = bankName;
        this.restrictions = restrictions;
        this.constructionPeriod = constructionPeriod;
        this.surface = surface;
        this.charges = charges;
        this.loyers = loyers;
        this.caution = caution;
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

    public String getAdresse() {
        return adress;
    }

    public void setAdresse(String adresse) {
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

    public String getTypeChauffage() {
        return typeChauffage;
    }

    public void setTypeChauffage(String typeChauffage) {
        this.typeChauffage = typeChauffage;
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

    public void setSurface(BigDecimal superficie) {
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

    @Override
    public String toString() {
        return "Appartement{" +
                "id=" + id +
                ", nom='" + name + '\'' +
                ", adresse='" + adress + '\'' +
                ", chambres=" + chambres +
                ", caracteristiques=" + caracteristiques +
                ", typeChauffage='" + typeChauffage + '\'' +
                ", chauffageCollectif=" + chauffageCollectif +
                ", bankName='" + bankName + '\'' +
                ", restrictions='" + restrictions + '\'' +
                ", constructionPeriod='" + constructionPeriod + '\'' +
                ", surface=" + surface +
                ", charges=" + charges +
                ", loyers=" + loyers +
                ", caution=" + caution +
                '}';
    }
}
