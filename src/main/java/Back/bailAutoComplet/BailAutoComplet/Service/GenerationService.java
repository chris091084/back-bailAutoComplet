package Back.bailAutoComplet.BailAutoComplet.Service;

import Back.bailAutoComplet.BailAutoComplet.Repository.GenerationRepository;
import Back.bailAutoComplet.BailAutoComplet.model.Generation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GenerationService {

    private final GenerationRepository generationRepository;

    @Autowired
    public GenerationService(GenerationRepository generationRepository) {
        this.generationRepository = generationRepository;
    }

    public Generation saveGeneration(Generation generation) {
        return generationRepository.save(generation);
    }

    public List<Generation> getAllGenerations() {
        return generationRepository.findAll();
    }
}
