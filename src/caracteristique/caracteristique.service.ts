import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { Caracteristique } from './caracteristique.entity';
import { UpsertCaracteristiqueDto } from './dto/upsert-caracteristique.dto';

@Injectable()
export class CaracteristiqueService {
  constructor(
    @InjectRepository(Caracteristique)
    private readonly caracteristiqueRepository: Repository<Caracteristique>,
  ) {}

  getAllCaracteristique(): Promise<Caracteristique[]> {
    return this.caracteristiqueRepository.find({ order: { id: 'ASC' } });
  }

  getCaracteristiqueByAppartementId(
    appartementId: number,
  ): Promise<Caracteristique[]> {
    return this.caracteristiqueRepository.find({
      where: { appartement: { id: appartementId } },
      order: { id: 'ASC' },
    });
  }

  createCaracteristique(
    details: UpsertCaracteristiqueDto,
  ): Promise<Caracteristique> {
    const caracteristique = this.caracteristiqueRepository.create({
      description: details.description,
      appartement:
        details.appartementId != null
          ? ({ id: details.appartementId } as Appartement)
          : undefined,
    });

    return this.caracteristiqueRepository.save(caracteristique);
  }

  /**
   * Ne modifie rien et renvoie la caractéristique existante : c'est le
   * comportement du CaracteristiqueService Java, dont le corps se réduisait au
   * commentaire « Update fields here if necessary ». Le portage reste fidèle
   * pour ne pas changer le contrat sans décision explicite.
   */
  async updateCaracteristique(id: number): Promise<Caracteristique> {
    const caracteristique = await this.caracteristiqueRepository.findOneBy({
      id,
    });

    if (!caracteristique) {
      throw new NotFoundException(`Caracteristique not found with id: ${id}`);
    }

    return caracteristique;
  }

  async deleteCaracteristique(id: number): Promise<void> {
    await this.caracteristiqueRepository.delete(id);
  }
}
