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

import java.math.BigDecimal;
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
    if (rentRefDto.getRentRef() != null) {
        appartement.setRentRef(rentRefDto.getRentRef());
    }
    if (rentRefDto.getRentRefMaj() != null) {
        appartement.setRentRefMaj(rentRefDto.getRentRefMaj());
    }

    Appartement updatedAppartement = appartementRepository.save(appartement);

    return new AppartementDto(updatedAppartement);
}catch (EntityNotFoundException e){

     throw new ResourceExceptionNoFound("L'appartement avec l'id " + rentRefDto.getIdAppartement() + " n'a pas été trouvé.", e);
}
    }

    public AppartementDto setValIrlTirl(ValIrlTIrlDto valIrlTIrlDto) {
        try {
            Appartement appartement = appartementRepository.getReferenceById(valIrlTIrlDto.getIdAppartement());
            if (valIrlTIrlDto.getValue() != null && ValIrlTIrlDto.VAL_IRL.equals(valIrlTIrlDto.getFieldName()) ){
                appartement.setValIrl(valIrlTIrlDto.getValue());
            }else
            {
                appartement.settIrl(valIrlTIrlDto.getValue());
            }

            Appartement updatedAppartement = appartementRepository.save(appartement);

            return new AppartementDto(updatedAppartement);
        }catch (EntityNotFoundException e){

            throw new ResourceExceptionNoFound("L'appartement avec l'id " + valIrlTIrlDto.getIdAppartement() + " n'a pas été trouvé.", e);
        }
    }
}

