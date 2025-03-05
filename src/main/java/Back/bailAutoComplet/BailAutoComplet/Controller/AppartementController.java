package Back.bailAutoComplet.BailAutoComplet.Controller;

import Back.bailAutoComplet.BailAutoComplet.Dto.AppartementDto;
import Back.bailAutoComplet.BailAutoComplet.Service.AppartementService;
import Back.bailAutoComplet.BailAutoComplet.model.Appartement;
import Back.bailAutoComplet.BailAutoComplet.model.Bailleur;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/appartement")
@CrossOrigin(origins =  "http://localhost:4200")
public class AppartementController {
    @Autowired
    private AppartementService appartementService;

    @GetMapping
    public List<AppartementDto> getAllAppartement() {
        return appartementService.getAllAppartement();
    }
}
