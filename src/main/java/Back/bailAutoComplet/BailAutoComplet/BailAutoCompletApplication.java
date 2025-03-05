package Back.bailAutoComplet.BailAutoComplet;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.CrossOrigin;

@SpringBootApplication
@CrossOrigin(origins =  "http://localhost:4200")
public class BailAutoCompletApplication {

	public static void main(String[] args) {
		SpringApplication.run(BailAutoCompletApplication.class, args);
	}

}
