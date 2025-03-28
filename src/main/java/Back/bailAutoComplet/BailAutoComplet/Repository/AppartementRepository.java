package Back.bailAutoComplet.BailAutoComplet.Repository;

import Back.bailAutoComplet.BailAutoComplet.model.Appartement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AppartementRepository extends JpaRepository<Appartement,Long> {
    List<Appartement> findAllByOrderByIdAsc();
}
