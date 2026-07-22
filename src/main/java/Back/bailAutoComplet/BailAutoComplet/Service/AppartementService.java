package Back.bailAutoComplet.BailAutoComplet.Service;


import Back.bailAutoComplet.BailAutoComplet.Dto.AppartementDto;
import Back.bailAutoComplet.BailAutoComplet.Dto.IrlDto;
import Back.bailAutoComplet.BailAutoComplet.Dto.RentRefDto;
import Back.bailAutoComplet.BailAutoComplet.Dto.ValIrlTIrlDto;
import Back.bailAutoComplet.BailAutoComplet.Repository.AppartementRepository;
import Back.bailAutoComplet.BailAutoComplet.exceptions.ResourceExceptionNoFound;
import Back.bailAutoComplet.BailAutoComplet.model.Appartement;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class AppartementService {

    @Autowired
    private AppartementRepository appartementRepository;

    @Autowired
    private IrlService irlService;

    public List<AppartementDto> getAllAppartement() {
        List<Appartement> appartements = appartementRepository.findAllByOrderByIdAsc();

        if(appartements.isEmpty())
        {
            throw new ResourceExceptionNoFound("pas d'appartement disponible");
        }

        // On ne récupère l'IRL qu'une fois pour toute la liste (mis en cache dans IrlService).
        Optional<IrlDto> latestIrl = irlService.getLatestIrl();
        appartements.forEach(appartement -> applyLatestIrl(appartement, latestIrl));

       return appartements.stream()
               .map(AppartementDto::new)
               .collect(Collectors.toList());
    }

    /**
     * Remplit valIrl/tIrl avec la dernière valeur INSEE tant que l'IRL n'a pas été
     * saisi à la main ({@code irlManual}). Persiste la mise à jour le cas échéant.
     */
    private void applyLatestIrl(Appartement appartement, Optional<IrlDto> latestIrl) {
        if (Boolean.TRUE.equals(appartement.getIrlManual())) {
            return;
        }
        latestIrl.ifPresent(irl -> {
            appartement.setValIrl(irl.valIrl());
            appartement.settIrl(irl.tIrl());
            appartementRepository.save(appartement);
        });
    }

    public AppartementDto setRentRefAndRentRefMaj(RentRefDto rentRefDto ){
        try {
            Appartement appartement = appartementRepository.getReferenceById(rentRefDto.getIdAppartement());
            if (rentRefDto.getValue() != null && RentRefDto.RENT_REF.equals(rentRefDto.getFieldName()) ){
                appartement.setRentRef(rentRefDto.getValue());
            }else
            {
                appartement.setRentRefMaj(rentRefDto.getValue());
            }
            

            Appartement updatedAppartement = appartementRepository.save(appartement);
            
            syncFilatureGroup(updatedAppartement, rentRefDto);

            return new AppartementDto(updatedAppartement);
        }catch (EntityNotFoundException e){

            throw new ResourceExceptionNoFound("L'appartement avec l'id " + rentRefDto.getIdAppartement() + " n'a pas été trouvé.", e);
        }
    }

    private void syncFilatureGroup(Appartement currentAppartement, RentRefDto rentRefDto) {
        Long currentId = currentAppartement.getId();
        if (currentId == null || (currentId != 1L && currentId != 4L)) {
            return;
        }

        Long targetId = (currentId == 1L) ? 4L : 1L;

        appartementRepository.findById(targetId).ifPresent(other -> {
            boolean shouldSave = false;
            
            if (rentRefDto.getValue() != null && RentRefDto.RENT_REF.equals(rentRefDto.getFieldName())) {
                if (!rentRefDto.getValue().equals(other.getRentRef())) {
                    other.setRentRef(rentRefDto.getValue());
                    shouldSave = true;
                }
            } else {
                if (rentRefDto.getValue() == null ? other.getRentRefMaj() != null : !rentRefDto.getValue().equals(other.getRentRefMaj())) {
                    other.setRentRefMaj(rentRefDto.getValue());
                    shouldSave = true;
                }
            }
            
            if (shouldSave) {
                appartementRepository.save(other);
            }
        });
    }


    public void setValIrlTirl(ValIrlTIrlDto valIrlTIrlDto) {
            // Une saisie manuelle non vide passe l'IRL en mode "manuel" ; une valeur
            // vide/nulle rebascule vers le remplissage automatique depuis l'INSEE.
            boolean manual = valIrlTIrlDto.getValue() != null && !valIrlTIrlDto.getValue().isBlank();
            if (ValIrlTIrlDto.VAL_IRL.equals(valIrlTIrlDto.getFieldName())){
               appartementRepository.updateAllValIrl(valIrlTIrlDto.getValue(), manual);
            }else
            {
                appartementRepository.updateAllTirl(valIrlTIrlDto.getValue(), manual);
            }
    }
    public AppartementDto getAppartementById(Long id) {
        Appartement appartement = appartementRepository.findById(id)
                .orElseThrow(() -> new ResourceExceptionNoFound("Appartement not found with id: " + id));

        // Tant que l'IRL n'a pas été saisi à la main, on le remplit avec la dernière
        // valeur publiée par l'INSEE. En cas d'échec de l'API, on garde la valeur en base.
        applyLatestIrl(appartement, irlService.getLatestIrl());

        return new AppartementDto(appartement);
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
        // Une saisie manuelle (valeur non vide) fige l'IRL ; une valeur vide rebascule
        // vers le remplissage automatique depuis l'INSEE lors du prochain GET.
        if(appartementDetails.getValIrl() != null || appartementDetails.gettIrl() != null) {
            boolean hasValue = (appartementDetails.getValIrl() != null && !appartementDetails.getValIrl().isBlank())
                    || (appartementDetails.gettIrl() != null && !appartementDetails.gettIrl().isBlank());
            appartement.setIrlManual(hasValue);
        }
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

