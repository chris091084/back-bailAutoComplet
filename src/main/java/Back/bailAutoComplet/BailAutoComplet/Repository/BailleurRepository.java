
package Back.bailAutoComplet.BailAutoComplet.Repository;


import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.stereotype.Repository;

import Back.bailAutoComplet.BailAutoComplet.model.Bailleur;


@Repository
public interface BailleurRepository extends JpaRepository<Bailleur, Long> {
    

}