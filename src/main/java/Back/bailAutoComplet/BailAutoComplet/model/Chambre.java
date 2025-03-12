package Back.bailAutoComplet.BailAutoComplet.model;

import jakarta.persistence.*;
@Entity
@Table(name = "chambre")
public class Chambre {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String piece;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "appartement_id", nullable = false)
    private Appartement appartement;


    public Chambre() {
    }

    // Constructeurs
    public Chambre(String piece, Appartement appartement) {
        this.piece = piece;
        this.appartement = appartement;
    }

    // Getters et Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPiece() {
        return piece;
    }

    public void setPiece(String description) {
        this.piece = description;
    }

    public Appartement getAppartement() {
        return appartement;
    }

    public void setAppartement(Appartement appartement) {
        this.appartement = appartement;
    }
}
