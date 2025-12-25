package Back.bailAutoComplet.BailAutoComplet.Repository;

import Back.bailAutoComplet.BailAutoComplet.model.Generation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GenerationRepository extends JpaRepository<Generation, String> {
}
