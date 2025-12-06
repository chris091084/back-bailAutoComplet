package Back.bailAutoComplet.BailAutoComplet.Service;

import Back.bailAutoComplet.BailAutoComplet.Repository.ChambreRepository;
import Back.bailAutoComplet.BailAutoComplet.exceptions.ResourceExceptionNoFound;
import Back.bailAutoComplet.BailAutoComplet.model.Chambre;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ChambreService {

    @Autowired
    private ChambreRepository chambreRepository;

    public List<Chambre> getAllChambres() {
        return chambreRepository.findAll();
    }

    public Chambre getChambreById(Long id) {
        return chambreRepository.findById(id)
                .orElseThrow(() -> new ResourceExceptionNoFound("Chambre not found with id: " + id));
    }

    public Chambre createChambre(Chambre chambre) {
        return chambreRepository.save(chambre);
    }

    public Chambre updateChambre(Long id, Chambre chambreDetails) {
        Chambre chambre = getChambreById(id);
        chambre.setPiece(chambreDetails.getPiece());
        chambre.setAppartement(chambreDetails.getAppartement());
        // Add other fields updates if necessary
        return chambreRepository.save(chambre);
    }

    public void deleteChambre(Long id) {
        Chambre chambre = getChambreById(id);
        chambreRepository.delete(chambre);
    }
}
