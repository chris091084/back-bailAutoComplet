package Back.bailAutoComplet.BailAutoComplet.Controller;

import Back.bailAutoComplet.BailAutoComplet.Service.GenerationService;
import Back.bailAutoComplet.BailAutoComplet.model.Generation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/generation")
@CrossOrigin(origins = "http://localhost:4200") // Allowing typical angular port, can be adjusted
public class GenerationController {

    private final GenerationService generationService;

    @Autowired
    public GenerationController(GenerationService generationService) {
        this.generationService = generationService;
    }

    @PostMapping
    public ResponseEntity<Generation> createGeneration(@RequestBody Generation generation) {
        Generation saved = generationService.saveGeneration(generation);
        return ResponseEntity.ok(saved);
    }

    @GetMapping
    public ResponseEntity<List<Generation>> getAllGenerations() {
        return ResponseEntity.ok(generationService.getAllGenerations());
    }
}
