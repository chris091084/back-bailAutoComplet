package Back.bailAutoComplet.BailAutoComplet.Controller;

import Back.bailAutoComplet.BailAutoComplet.Service.CaracteristiqueService;
import Back.bailAutoComplet.BailAutoComplet.model.Caracteristique;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
@RestController
@RequestMapping("/caracteristique")
public class CaracteristiqueController {
    @Autowired
    private CaracteristiqueService caracteristiqueService;

    @GetMapping
    public List<Caracteristique> getAllCaracteristique() {
        return caracteristiqueService.getAllCaracteristique();
    }
    @GetMapping("/{id}")
    public ResponseEntity<Caracteristique> getCaracteristiqueById(@PathVariable Long id) {
         return caracteristiqueService.getCaracteristiqueById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Caracteristique> createCaracteristique(@RequestBody Caracteristique caracteristique) {
        return ResponseEntity.ok(caracteristiqueService.createCaracteristique(caracteristique));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Caracteristique> updateCaracteristique(@PathVariable Long id, @RequestBody Caracteristique caracteristique) {
        return ResponseEntity.ok(caracteristiqueService.updateCaracteristique(id, caracteristique));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCaracteristique(@PathVariable Long id) {
        caracteristiqueService.deleteCaracteristique(id);
        return ResponseEntity.noContent().build();
    }
}
