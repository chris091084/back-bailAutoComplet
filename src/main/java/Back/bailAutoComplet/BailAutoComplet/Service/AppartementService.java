package Back.bailAutoComplet.BailAutoComplet.Service;

import Back.bailAutoComplet.BailAutoComplet.Repository.AppartementRepository;
import Back.bailAutoComplet.BailAutoComplet.model.Appartement;
import Back.bailAutoComplet.BailAutoComplet.model.Bailleur;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AppartementService {

    @Autowired
    private AppartementRepository appartementRepository;

    public List<Appartement> getAllAppartement() {
        return appartementRepository.findAll();
    }

}

