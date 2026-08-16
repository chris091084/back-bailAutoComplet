import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { Chambre } from './chambre.entity';
import { UpsertChambreDto } from './dto/upsert-chambre.dto';

@Injectable()
export class ChambreService {
  constructor(
    @InjectRepository(Chambre)
    private readonly chambreRepository: Repository<Chambre>,
  ) {}

  getAllChambres(): Promise<Chambre[]> {
    return this.chambreRepository.find({ order: { id: 'ASC' } });
  }

  async getChambreById(id: number): Promise<Chambre> {
    const chambre = await this.chambreRepository.findOneBy({ id });

    if (!chambre) {
      throw new NotFoundException(`Chambre not found with id: ${id}`);
    }

    return chambre;
  }

  createChambre(details: UpsertChambreDto): Promise<Chambre> {
    const chambre = this.chambreRepository.create({
      piece: details.piece,
      caracteristiqueExceptionelle:
        details.caracteristiqueExceptionelle ?? null,
      couleur: details.couleur ?? null,
      appartement:
        details.appartementId != null
          ? ({ id: details.appartementId } as Appartement)
          : undefined,
    });

    return this.chambreRepository.save(chambre);
  }

  async updateChambre(id: number, details: UpsertChambreDto): Promise<Chambre> {
    const chambre = await this.getChambreById(id);

    if (details.piece != null) {
      chambre.piece = details.piece;
    }
    if (details.appartementId != null) {
      chambre.appartement = { id: details.appartementId } as Appartement;
    }
    if (details.couleur !== undefined) {
      chambre.couleur = details.couleur ?? null;
    }

    return this.chambreRepository.save(chambre);
  }

  async deleteChambre(id: number): Promise<void> {
    const chambre = await this.getChambreById(id);
    await this.chambreRepository.remove(chambre);
  }
}
