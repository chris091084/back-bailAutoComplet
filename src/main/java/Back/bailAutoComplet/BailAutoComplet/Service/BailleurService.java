package Back.bailAutoComplet.BailAutoComplet.Service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import Back.bailAutoComplet.BailAutoComplet.Repository.BailleurRepository;
import Back.bailAutoComplet.BailAutoComplet.model.Bailleur;

import java.util.List;

@Service
public class BailleurService {

    @Autowired
    private BailleurRepository bailleurRepository;

    public List<Bailleur> getAllBailleurs() {
        return bailleurRepository.findAll();
    }

    public Bailleur getBailleurById(Long id) {
        return bailleurRepository.findById(id).orElse(null);
    }

    public Bailleur saveBailleur(Bailleur bailleur) {
        return bailleurRepository.save(bailleur);
    }

    public void deleteBailleur(Long id) {
        bailleurRepository.deleteById(id);
    }
}
