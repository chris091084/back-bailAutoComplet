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
}
