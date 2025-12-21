package Back.bailAutoComplet.BailAutoComplet.Service;


import Back.bailAutoComplet.BailAutoComplet.Repository.CaracteristiqueRepository;
import Back.bailAutoComplet.BailAutoComplet.model.Caracteristique;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
@Service
public class CaracteristiqueService {
    @Autowired
    private CaracteristiqueRepository caracteristiqueRepository;

    public List<Caracteristique> getAllCaracteristique() {
        return caracteristiqueRepository.findAll();
    }
    public java.util.Optional<Caracteristique> getCaracteristiqueById(Long id) {
        return caracteristiqueRepository.findById(id);
    }

    public Caracteristique createCaracteristique(Caracteristique caracteristique) {
        return caracteristiqueRepository.save(caracteristique);
    }

    public Caracteristique updateCaracteristique(Long id, Caracteristique caracteristiqueDetails) {
        Caracteristique caracteristique = caracteristiqueRepository.findById(id).orElseThrow(() -> new RuntimeException("Caracteristique not found"));
        // Update fields here if necessary
        return caracteristiqueRepository.save(caracteristique);
    }

    public void deleteCaracteristique(Long id) {
        caracteristiqueRepository.deleteById(id);
    }
}
