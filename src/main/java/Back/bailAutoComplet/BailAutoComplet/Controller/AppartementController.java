package Back.bailAutoComplet.BailAutoComplet.Controller;

import Back.bailAutoComplet.BailAutoComplet.Dto.AppartementDto;
import Back.bailAutoComplet.BailAutoComplet.Dto.RentRefDto;
import Back.bailAutoComplet.BailAutoComplet.Dto.ValIrlTIrlDto;
import Back.bailAutoComplet.BailAutoComplet.Service.AppartementService;
import Back.bailAutoComplet.BailAutoComplet.model.Appartement;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    @GetMapping("/{id}")
    public ResponseEntity<AppartementDto> getAppartementById(@PathVariable Long id) {
        return ResponseEntity.ok(appartementService.getAppartementById(id));
    }

    @PostMapping
    public ResponseEntity<AppartementDto> createAppartement(@RequestBody Appartement appartement) {
        return ResponseEntity.ok(appartementService.createAppartement(appartement));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AppartementDto> updateAppartement(@PathVariable Long id, @RequestBody Appartement appartement) {
        return ResponseEntity.ok(appartementService.updateAppartement(id, appartement));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAppartement(@PathVariable Long id) {
        appartementService.deleteAppartement(id);
        return ResponseEntity.noContent().build();
    }
}
