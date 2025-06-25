package Back.bailAutoComplet.BailAutoComplet.Repository;

import Back.bailAutoComplet.BailAutoComplet.model.Appartement;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AppartementRepository extends JpaRepository<Appartement,Long> {
    List<Appartement> findAllByOrderByIdAsc();

    @Modifying
    @Transactional
    @Query("UPDATE Appartement a " +
            "SET a.tIrl = :tIrlValue" )
    void updateAllTirl(@Param("tIrlValue") String tIrlValue);

    @Modifying
    @Transactional
    @Query("UPDATE Appartement a " +
            "SET  a.valIrl = :valIrlValue")
    void updateAllValIrl(@Param("valIrlValue") String valIrlValue);
}
