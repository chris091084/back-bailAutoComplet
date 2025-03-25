package Back.bailAutoComplet.BailAutoComplet.Dto;

import java.math.BigDecimal;

public class RentRefDto {

    private long idAppartement;
    private BigDecimal rentRef;
    private  BigDecimal rentRefMaj;

    public RentRefDto(long idAppartement, BigDecimal rentRef, BigDecimal rentRefMaj) {
        this.idAppartement = idAppartement;
        this.rentRef = rentRef;
        this.rentRefMaj = rentRefMaj;
    }

    public long getId() {
        return idAppartement;
    }

    public void  setId(long idAppartement) {
        this.idAppartement = idAppartement;
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
}
