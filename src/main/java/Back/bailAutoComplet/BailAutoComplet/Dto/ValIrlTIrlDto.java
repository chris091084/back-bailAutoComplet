package Back.bailAutoComplet.BailAutoComplet.Dto;

public class ValIrlTIrlDto {

    public static final String VAL_IRL = "valIrl";
    public static final String T_IRL = "tIrl";

    private long idAppartement;
    private String fieldName;
    private String value;


    public ValIrlTIrlDto(String fieldName, String value) {
        this.fieldName = fieldName;
        this.value = value;
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
