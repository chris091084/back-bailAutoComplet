package Back.bailAutoComplet.BailAutoComplet.Dto;

import java.math.BigDecimal;

public class RentRefDto {

    public static final String RENT_REF = "rentRef";
    public static final String RENT_REF_MAJ = "rentRefMaj";

    private long idAppartement;
    private String fieldName;
    private String value;


    public RentRefDto(long idAppartement, String fieldName, String value) {
        this.idAppartement = idAppartement;
        this.fieldName = fieldName;
        this.value = value;
    }

    public long getIdAppartement() {
        return idAppartement;
    }

    public void setIdAppartement(long idAppartement) {
        this.idAppartement = idAppartement;
    }

    public String getFieldName() {
        return fieldName;
    }

    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }
}
