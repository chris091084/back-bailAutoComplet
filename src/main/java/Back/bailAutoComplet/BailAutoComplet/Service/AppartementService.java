package Back.bailAutoComplet.BailAutoComplet.Service;


import Back.bailAutoComplet.BailAutoComplet.Dto.AppartementDto;
import Back.bailAutoComplet.BailAutoComplet.Repository.AppartementRepository;
import Back.bailAutoComplet.BailAutoComplet.model.Appartement;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AppartementService {

    @Autowired
    private AppartementRepository appartementRepository;

    public List<AppartementDto> getAllAppartement() {
        List<Appartement> appartements = appartementRepository.findAll();


       return appartements.stream()
               .map(AppartementDto::new)  // Convertit chaque Appartement en AppartementDTO
               .collect(Collectors.toList());
    }

}

