import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { UpsertLocataireDto } from './dto/upsert-locataire.dto';
import { Locataire } from './locataire.entity';

@Injectable()
export class LocataireService {
  constructor(
    @InjectRepository(Locataire)
    private readonly locataireRepository: Repository<Locataire>,
    @InjectRepository(Appartement)
    private readonly appartementRepository: Repository<Appartement>,
  ) {}

  getAllLocataires(): Promise<Locataire[]> {
    return this.locataireRepository.find({
      relations: { appartement: true },
      order: { id: 'ASC' },
    });
  }

  async getLocataireById(id: number): Promise<Locataire> {
    const locataire = await this.locataireRepository.findOne({
      where: { id },
      relations: { appartement: true },
    });

    if (!locataire) {
      throw new NotFoundException(`Locataire not found with id: ${id}`);
    }

    return locataire;
  }

  findByAppartementId(appartementId: number): Promise<Locataire[]> {
    return this.locataireRepository.find({
      where: { appartement: { id: appartementId } },
      relations: { appartement: true },
      order: { id: 'ASC' },
    });
  }

  async createLocataire(details: UpsertLocataireDto): Promise<Locataire> {
    if (!details.nom || !details.prenom) {
      throw new BadRequestException('nom et prenom sont obligatoires');
    }

    const locataire = this.locataireRepository.create({
      nom: details.nom,
      prenom: details.prenom,
      telephone: details.telephone ?? null,
      email: details.email ?? null,
      appartement: await this.getAppartement(details.appartementId),
    });

    return this.locataireRepository.save(locataire);
  }

  async updateLocataire(
    id: number,
    details: UpsertLocataireDto,
  ): Promise<Locataire> {
    const locataire = await this.getLocataireById(id);

    if (details.nom != null) {
      locataire.nom = details.nom;
    }
    if (details.prenom != null) {
      locataire.prenom = details.prenom;
    }
    if (details.telephone !== undefined) {
      locataire.telephone = details.telephone;
    }
    if (details.email !== undefined) {
      locataire.email = details.email;
    }
    if (details.appartementId != null) {
      locataire.appartement = await this.getAppartement(details.appartementId);
    }

    return this.locataireRepository.save(locataire);
  }

  async deleteLocataire(id: number): Promise<void> {
    const locataire = await this.getLocataireById(id);
    await this.locataireRepository.remove(locataire);
  }

  /**
   * L'appartement est chargé plutôt que référencé par `{ id }` : la colonne
   * `appartement_id` étant NOT NULL, un id absent ou inconnu doit répondre 400
   * ou 404 au lieu de laisser remonter une violation de contrainte en 500.
   * L'entité complète permet en prime de renseigner `appartementNom` dans la
   * réponse d'une création, sans relecture.
   */
  private async getAppartement(appartementId?: number): Promise<Appartement> {
    if (appartementId == null) {
      throw new BadRequestException('appartementId est obligatoire');
    }

    const appartement = await this.appartementRepository.findOneBy({
      id: appartementId,
    });

    if (!appartement) {
      throw new NotFoundException(
        `Appartement not found with id: ${appartementId}`,
      );
    }

    return appartement;
  }
}
