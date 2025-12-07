package Back.bailAutoComplet.BailAutoComplet.Controller;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import Back.bailAutoComplet.BailAutoComplet.Service.BailleurService;
import Back.bailAutoComplet.BailAutoComplet.model.Bailleur;


@RestController
@RequestMapping("/bailleur")
public class BailleurController {

    @Autowired
    private BailleurService bailleurService;

    @GetMapping
    public List<Bailleur> getAllBailleurs() {
        return bailleurService.getAllBailleurs();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Bailleur> getBailleurById(@PathVariable Long id) {
        Bailleur bailleur = bailleurService.getBailleurById(id);
        if (bailleur != null) {
            return ResponseEntity.ok(bailleur);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<Bailleur> createBailleur(@RequestBody Bailleur bailleur) {
        return ResponseEntity.ok(bailleurService.createBailleur(bailleur));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Bailleur> updateBailleur(@PathVariable Long id, @RequestBody Bailleur bailleur) {
        return ResponseEntity.ok(bailleurService.updateBailleur(id, bailleur));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBailleur(@PathVariable Long id) {
        bailleurService.deleteBailleur(id);
        return ResponseEntity.noContent().build();
    }
}