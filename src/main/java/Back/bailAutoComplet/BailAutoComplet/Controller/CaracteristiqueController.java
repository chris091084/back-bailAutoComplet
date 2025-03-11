package Back.bailAutoComplet.BailAutoComplet.Controller;

import Back.bailAutoComplet.BailAutoComplet.Service.AppartementService;
import Back.bailAutoComplet.BailAutoComplet.Service.CaracteristiqueService;
import Back.bailAutoComplet.BailAutoComplet.model.Appartement;
import Back.bailAutoComplet.BailAutoComplet.model.Caracteristique;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
@RestController
@RequestMapping("/caracteristique")
public class CaracteristiqueController {
    @Autowired
    private CaracteristiqueService caracteristiqueService;

    @GetMapping
    public List<Caracteristique> getAllCaracteristique() {
        return caracteristiqueService.getAllCaracteristique();
    }
}
