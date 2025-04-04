package Back.bailAutoComplet.BailAutoComplet.Dto;

public class ValIrlTIrlDto {

    public static final String VAL_IRL = "valIrl";
    public static final String T_IRL = "tIrl";

    private long idAppartement;
    private String fieldName;
    private String value;


    public ValIrlTIrlDto(long idAppartement, String fieldName, String value) {
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
