package Back.bailAutoComplet.BailAutoComplet.Controller;

import Back.bailAutoComplet.BailAutoComplet.Dto.AppartementDto;
import Back.bailAutoComplet.BailAutoComplet.Dto.RentRefDto;
import Back.bailAutoComplet.BailAutoComplet.Dto.ValIrlTIrlDto;
import Back.bailAutoComplet.BailAutoComplet.Service.AppartementService;
import Back.bailAutoComplet.BailAutoComplet.model.Appartement;
import Back.bailAutoComplet.BailAutoComplet.model.Bailleur;
import jakarta.persistence.PostUpdate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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

    @PostMapping("/updateRent")
    public AppartementDto postRentRefAndRentRefMaj(@RequestBody RentRefDto rentRefDto) {
        return appartementService.setRentRefAndRentRefMaj(rentRefDto);
    }

    @PostMapping("/updateValIrlTirl")
    public void postValIrlTirl(@RequestBody ValIrlTIrlDto valIrlTIrlDto) {
         appartementService.setValIrlTirl(valIrlTIrlDto);
    }
}
