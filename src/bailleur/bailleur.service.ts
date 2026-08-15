import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bailleur } from './bailleur.entity';

@Injectable()
export class BailleurService {
  constructor(
    @InjectRepository(Bailleur)
    private readonly bailleurRepository: Repository<Bailleur>,
  ) {}

  getAllBailleurs(): Promise<Bailleur[]> {
    return this.bailleurRepository.find({ order: { id: 'ASC' } });
  }

  getBailleurById(id: number): Promise<Bailleur | null> {
    return this.bailleurRepository.findOneBy({ id });
  }

  createBailleur(bailleur: Partial<Bailleur>): Promise<Bailleur> {
    return this.bailleurRepository.save(
      this.bailleurRepository.create(bailleur),
    );
  }

  async updateBailleur(
    id: number,
    details: Partial<Bailleur>,
  ): Promise<Bailleur> {
    const bailleur = await this.bailleurRepository.findOneBy({ id });

    if (!bailleur) {
      throw new NotFoundException(`Bailleur not found with id: ${id}`);
    }

    // Mise à jour partielle : seuls les champs fournis écrasent l'existant.
    if (details.name != null) bailleur.name = details.name;
    if (details.adress != null) bailleur.adress = details.adress;
    if (details.email != null) bailleur.email = details.email;
    if (details.telephone != null) bailleur.telephone = details.telephone;

    return this.bailleurRepository.save(bailleur);
  }

  async deleteBailleur(id: number): Promise<void> {
    await this.bailleurRepository.delete(id);
  }
}
