package Back.bailAutoComplet.BailAutoComplet.model;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "generation")
public class Generation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(nullable = false)
    private Instant date;

    @Column(name = "appartement_name", nullable = false)
    private String appartementName;

    @Column(name = "locataire_name", nullable = false)
    private String locataireName;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "result_form_id", referencedColumnName = "id")
    private ResultForm resultForm;

    public Generation() {}

    public Generation(Instant date, String appartementName, String locataireName, ResultForm resultForm) {
        this.date = date;
        this.appartementName = appartementName;
        this.locataireName = locataireName;
        this.resultForm = resultForm;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Instant getDate() {
        return date;
    }

    public void setDate(Instant date) {
        this.date = date;
    }

    public String getAppartementName() {
        return appartementName;
    }

    public void setAppartementName(String appartementName) {
        this.appartementName = appartementName;
    }

    public String getLocataireName() {
        return locataireName;
    }

    public void setLocataireName(String locataireName) {
        this.locataireName = locataireName;
    }

    public ResultForm getResultForm() {
        return resultForm;
    }

    public void setResultForm(ResultForm resultForm) {
        this.resultForm = resultForm;
    }
}
