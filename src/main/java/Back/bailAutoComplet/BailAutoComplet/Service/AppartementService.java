package Back.bailAutoComplet.BailAutoComplet.Service;


import Back.bailAutoComplet.BailAutoComplet.Dto.AppartementDto;
import Back.bailAutoComplet.BailAutoComplet.Dto.RentRefDto;
import Back.bailAutoComplet.BailAutoComplet.Dto.ValIrlTIrlDto;
import Back.bailAutoComplet.BailAutoComplet.Repository.AppartementRepository;
import Back.bailAutoComplet.BailAutoComplet.exceptions.ResourceExceptionNoFound;
import Back.bailAutoComplet.BailAutoComplet.model.Appartement;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AppartementService {

    @Autowired
    private AppartementRepository appartementRepository;

    public List<AppartementDto> getAllAppartement() {
        List<Appartement> appartements = appartementRepository.findAllByOrderByIdAsc();

        if(appartements.isEmpty())
        {
            throw new ResourceExceptionNoFound("pas d'appartement disponible");
        }

        if(appartements.isEmpty())
        {
            throw new ResourceExceptionNoFound("pas d'appartement disponible");
        }

       return appartements.stream()
               .map(AppartementDto::new)
               .collect(Collectors.toList());
    }

    public AppartementDto setRentRefAndRentRefMaj(RentRefDto rentRefDto ){
        try {
            Appartement appartement = appartementRepository.getReferenceById(rentRefDto.getIdAppartement());
            if (rentRefDto.getValue() != null && RentRefDto.RENT_REF.equals(rentRefDto.getFieldName()) ){
                appartement.setValIrl(rentRefDto.getValue());
            }else
            {
                appartement.settIrl(rentRefDto.getValue());
            }

            Appartement updatedAppartement = appartementRepository.save(appartement);

            return new AppartementDto(updatedAppartement);
        }catch (EntityNotFoundException e){

            throw new ResourceExceptionNoFound("L'appartement avec l'id " + rentRefDto.getIdAppartement() + " n'a pas été trouvé.", e);
        }
    }


    public void setValIrlTirl(ValIrlTIrlDto valIrlTIrlDto) {
            if (valIrlTIrlDto.getValue() != null && ValIrlTIrlDto.VAL_IRL.equals(valIrlTIrlDto.getFieldName()) ){
               appartementRepository.updateAllValIrl(valIrlTIrlDto.getValue());
            }else
            {
                appartementRepository.updateAllTirl(valIrlTIrlDto.getValue());
            }
    }
    public AppartementDto getAppartementById(Long id) {
        return appartementRepository.findById(id)
                .map(AppartementDto::new)
                .orElseThrow(() -> new ResourceExceptionNoFound("Appartement not found with id: " + id));
    }

    public AppartementDto createAppartement(Appartement appartement) {
        Appartement savedAppartement = appartementRepository.save(appartement);
        return new AppartementDto(savedAppartement);
    }

    public AppartementDto updateAppartement(Long id, Appartement appartementDetails) {
        Appartement appartement = appartementRepository.findById(id)
                .orElseThrow(() -> new ResourceExceptionNoFound("Appartement not found with id: " + id));
        
        // Update fields
        if(appartementDetails.getValIrl() != null) appartement.setValIrl(appartementDetails.getValIrl());
        if(appartementDetails.gettIrl() != null) appartement.settIrl(appartementDetails.gettIrl());
        // Handle other fields as necessary, potentially passed via DTO or Entity
        
        Appartement updatedAppartement = appartementRepository.save(appartement);
        return new AppartementDto(updatedAppartement);
    }

    public void deleteAppartement(Long id) {
        Appartement appartement = appartementRepository.findById(id)
                .orElseThrow(() -> new ResourceExceptionNoFound("Appartement not found with id: " + id));
        appartementRepository.delete(appartement);
    }
}

