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

public Bailleur createBailleur(Bailleur bailleur) {
        return bailleurRepository.save(bailleur);
    }

    public Bailleur updateBailleur(Long id, Bailleur bailleurDetails) {
        Bailleur bailleur = bailleurRepository.findById(id).orElseThrow(() -> new RuntimeException("Bailleur not found"));
        // Update fields 
        if (bailleurDetails.getName() != null) bailleur.setName(bailleurDetails.getName());
        if (bailleurDetails.getAdress() != null) bailleur.setAdress(bailleurDetails.getAdress());
        if (bailleurDetails.getEmail() != null) bailleur.setEmail(bailleurDetails.getEmail());
        if (bailleurDetails.getTelephone() != null) bailleur.setTelephone(bailleurDetails.getTelephone());
        
        return bailleurRepository.save(bailleur);
    }

    public void deleteBailleur(Long id) {
        bailleurRepository.deleteById(id);
    }
}
