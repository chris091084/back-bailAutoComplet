package Back.bailAutoComplet.BailAutoComplet.Controller;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import Back.bailAutoComplet.BailAutoComplet.Service.BailleurService;
import Back.bailAutoComplet.BailAutoComplet.model.Bailleur;


@RestController
@RequestMapping("/bailleur")
public class BailleurController {

    @Autowired
    private BailleurService bailleurService;

    @GetMapping
    public List<Bailleur> getAllBailleurs() {
        return bailleurService.getAllBailleurs();
    }

}