package Back.bailAutoComplet.BailAutoComplet.Repository;

import Back.bailAutoComplet.BailAutoComplet.model.Caracteristique;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CaracteristiqueRepository extends JpaRepository<Caracteristique,Long> {

List<Caracteristique> findByAppartementIdOrderByIdAsc(Long appartementId);
}
