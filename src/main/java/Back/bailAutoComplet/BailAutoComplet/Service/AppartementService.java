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
}

