package Back.bailAutoComplet.BailAutoComplet.exceptions;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
public class ResourceExceptionNoFound extends RuntimeException {

    public  ResourceExceptionNoFound(String message) {
        super(message);
    }
    public  ResourceExceptionNoFound(String message,Throwable cause) {
        super(message);
    }
}
