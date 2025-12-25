package Back.bailAutoComplet.BailAutoComplet.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.Date;

@Entity
@Table(name = "result_form")
public class ResultForm {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT")
    private String adress;

    @ManyToOne
    @JoinColumn(name = "appartement_id")
    private Appartement appartement;

    @Column(name = "charge_price")
    private BigDecimal chargePrice;

    private String email;

    private String firstname;

    @Temporal(TemporalType.DATE)
    @Column(name = "date_from")
    private Date from;

    @Temporal(TemporalType.DATE)
    @Column(name = "date_to")
    private Date to;

    @Column(columnDefinition = "TEXT")
    private String motif;

    private String name;

    @Column(name = "price_no_charge")
    private BigDecimal priceNoCharge;

    private String room;

    private String telephone;

    @ManyToOne
    @JoinColumn(name = "bailleur_id")
    private Bailleur bailleur;

    @Column(name = "bail_type")
    private String bailType;

    @Column(name = "t_irl")
    private String tIrl;

    @Column(name = "val_irl")
    private String valIrl;

    @Column(name = "last_price_without_charge")
    private BigDecimal lastPriceWithoutCharge;

    @Column(name = "charge_list")
    private Boolean chargeList;

    @Column(name = "clause_less_6_month")
    private Boolean clauseLess6Month;

    @Column(name = "type_residence")
    private String typeResidence;

    @Column(name = "rent_ref")
    private BigDecimal rentRef;

    @Column(name = "rent_ref_maj")
    private BigDecimal rentRefMaj;

    // Constructors
    public ResultForm() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getAdress() { return adress; }
    public void setAdress(String adress) { this.adress = adress; }

    public Appartement getAppartement() { return appartement; }
    public void setAppartement(Appartement appartement) { this.appartement = appartement; }

    public BigDecimal getChargePrice() { return chargePrice; }
    public void setChargePrice(BigDecimal chargePrice) { this.chargePrice = chargePrice; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getFirstname() { return firstname; }
    public void setFirstname(String firstname) { this.firstname = firstname; }

    public Date getFrom() { return from; }
    public void setFrom(Date from) { this.from = from; }

    public Date getTo() { return to; }
    public void setTo(Date to) { this.to = to; }

    public String getMotif() { return motif; }
    public void setMotif(String motif) { this.motif = motif; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public BigDecimal getPriceNoCharge() { return priceNoCharge; }
    public void setPriceNoCharge(BigDecimal priceNoCharge) { this.priceNoCharge = priceNoCharge; }

    public String getRoom() { return room; }
    public void setRoom(String room) { this.room = room; }

    public String getTelephone() { return telephone; }
    public void setTelephone(String telephone) { this.telephone = telephone; }

    public Bailleur getBailleur() { return bailleur; }
    public void setBailleur(Bailleur bailleur) { this.bailleur = bailleur; }

    public String getBailType() { return bailType; }
    public void setBailType(String bailType) { this.bailType = bailType; }

    public String gettIrl() { return tIrl; }
    public void settIrl(String tIrl) { this.tIrl = tIrl; }

    public String getValIrl() { return valIrl; }
    public void setValIrl(String valIrl) { this.valIrl = valIrl; }

    public BigDecimal getLastPriceWithoutCharge() { return lastPriceWithoutCharge; }
    public void setLastPriceWithoutCharge(BigDecimal lastPriceWithoutCharge) { this.lastPriceWithoutCharge = lastPriceWithoutCharge; }

    public Boolean getChargeList() { return chargeList; }
    public void setChargeList(Boolean chargeList) { this.chargeList = chargeList; }

    public Boolean getClauseLess6Month() { return clauseLess6Month; }
    public void setClauseLess6Month(Boolean clauseLess6Month) { this.clauseLess6Month = clauseLess6Month; }

    public String getTypeResidence() { return typeResidence; }
    public void setTypeResidence(String typeResidence) { this.typeResidence = typeResidence; }

    public BigDecimal getRentRef() { return rentRef; }
    public void setRentRef(BigDecimal rentRef) { this.rentRef = rentRef; }

    public BigDecimal getRentRefMaj() { return rentRefMaj; }
    public void setRentRefMaj(BigDecimal rentRefMaj) { this.rentRefMaj = rentRefMaj; }
}
