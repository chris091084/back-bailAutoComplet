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
    private String nom;

    @ManyToOne()
    @JoinColumn(name = "bailleur_id", nullable = false)
    private Bailleur bailleur;

    @Column(nullable = false)
    private String adresse;

    @Column(name = "chambre")
    private List<String> chambres;

    @OneToMany(mappedBy = "appartement", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Caracteristique> caracteristiques;

    @Column(name = "type_chauffage", nullable = false)
    private String typeChauffage;

    @Column(name = "chauffage_collectif", nullable = false)
    private Boolean chauffageCollectif;

    @Column(name = "informations_bancaires", columnDefinition = "TEXT")
    private String informationsBancaires;

    @Column(columnDefinition = "TEXT")
    private String restrictions;

    @Column(name = "annee_construction")
    private String anneeConstruction;

    @Column(name = "superficie")
    private BigDecimal superficie;

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
            String nom,
            Bailleur bailleur,
            String adresse,
            List<String> chambres,
            List<Caracteristique> caracteristiques,
            String typeChauffage,
            Boolean chauffageCollectif,
            String informationsBancaires,
            String restrictions,
            String anneeConstruction,
            BigDecimal superficie,
            BigDecimal charges,
            BigDecimal loyers,
            BigDecimal caution
    ) {
        this.nom = nom;
        this.bailleur = bailleur;
        this.adresse = adresse;
        this.chambres = chambres;
        this.caracteristiques = caracteristiques;
        this.typeChauffage = typeChauffage;
        this.chauffageCollectif = chauffageCollectif;
        this.informationsBancaires = informationsBancaires;
        this.restrictions = restrictions;
        this.anneeConstruction = anneeConstruction;
        this.superficie = superficie;
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

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }

    public Bailleur getBailleur() {
        return bailleur;
    }

    public void setBailleur(Bailleur bailleur) {
        this.bailleur = bailleur;
    }

    public String getAdresse() {
        return adresse;
    }

    public void setAdresse(String adresse) {
        this.adresse = adresse;
    }

    public List<String> getChambres() {
        return chambres;
    }

    public void setChambres(List<String> chambres) {
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

    public String getInformationsBancaires() {
        return informationsBancaires;
    }

    public void setInformationsBancaires(String informationsBancaires) {
        this.informationsBancaires = informationsBancaires;
    }

    public String getRestrictions() {
        return restrictions;
    }

    public void setRestrictions(String restrictions) {
        this.restrictions = restrictions;
    }

    public String getAnneeConstruction() {
        return anneeConstruction;
    }

    public void setAnneeConstruction(String anneeConstruction) {
        this.anneeConstruction = anneeConstruction;
    }

    public BigDecimal getSuperficie() {
        return superficie;
    }

    public void setSuperficie(BigDecimal superficie) {
        this.superficie = superficie;
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
                ", nom='" + nom + '\'' +
                ", adresse='" + adresse + '\'' +
                ", chambres=" + chambres +
                ", caracteristiques=" + caracteristiques +
                ", typeChauffage='" + typeChauffage + '\'' +
                ", chauffageCollectif=" + chauffageCollectif +
                ", informationsBancaires='" + informationsBancaires + '\'' +
                ", restrictions='" + restrictions + '\'' +
                ", anneeConstruction='" + anneeConstruction + '\'' +
                ", superficie=" + superficie +
                ", charges=" + charges +
                ", loyers=" + loyers +
                ", caution=" + caution +
                '}';
    }
}
