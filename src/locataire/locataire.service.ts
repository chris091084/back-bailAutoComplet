import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { ResultForm } from '../generation/result-form.entity';
import { UpsertLocataireDto } from './dto/upsert-locataire.dto';
import { Locataire } from './locataire.entity';

@Injectable()
export class LocataireService {
  constructor(
    @InjectRepository(Locataire)
    private readonly locataireRepository: Repository<Locataire>,
    @InjectRepository(Appartement)
    private readonly appartementRepository: Repository<Appartement>,
    @InjectRepository(ResultForm)
    private readonly resultFormRepository: Repository<ResultForm>,
  ) {}

  getAllLocataires(): Promise<Locataire[]> {
    return this.locataireRepository.find({
      relations: { appartement: true, resultForm: true },
      order: { id: 'ASC' },
    });
  }

  async getLocataireById(id: number): Promise<Locataire> {
    const locataire = await this.locataireRepository.findOne({
      where: { id },
      relations: { appartement: true, resultForm: true },
    });

    if (!locataire) {
      throw new NotFoundException(`Locataire not found with id: ${id}`);
    }

    return locataire;
  }

  findByAppartementId(appartementId: number): Promise<Locataire[]> {
    return this.locataireRepository.find({
      where: { appartement: { id: appartementId } },
      relations: { appartement: true, resultForm: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Un locataire n'existe que par le bail dont il est issu : `resultFormId` est
   * donc obligatoire à la création, ce qui ferme la saisie manuelle depuis la
   * liste des locataires. La modification, elle, reste libre.
   */
  async createLocataire(details: UpsertLocataireDto): Promise<Locataire> {
    if (!details.nom || !details.prenom) {
      throw new BadRequestException('nom et prenom sont obligatoires');
    }

    if (details.resultFormId == null) {
      throw new BadRequestException(
        "resultFormId est obligatoire : un locataire ne peut être créé qu'à partir d'un bail généré",
      );
    }

    const locataire = this.locataireRepository.create({
      nom: details.nom,
      prenom: details.prenom,
      telephone: details.telephone ?? null,
      email: details.email ?? null,
      appartement: await this.getAppartement(details.appartementId),
      resultForm: await this.getResultForm(details.resultFormId),
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
    // `!== undefined` et non `!= null` : un `null` explicite détache le
    // result_form, contrairement à `appartementId` qui reste obligatoire.
    if (details.resultFormId !== undefined) {
      locataire.resultForm = await this.getResultForm(details.resultFormId);
    }

    return this.locataireRepository.save(locataire);
  }

  /**
   * Horodate l'envoi de la lettre de congé. Volontairement hors d'
   * `updateLocataire` : c'est un fait constaté après l'envoi du mail, pas un
   * champ que la modale d'édition doit pouvoir écraser.
   *
   * Un nouvel envoi écrase la date précédente : c'est le dernier courrier parti
   * qui intéresse, pas l'historique.
   */
  async marquerResiliationEnvoyee(id: number): Promise<Locataire> {
    const locataire = await this.getLocataireById(id);
    locataire.resiliationEnvoyeeLe = new Date();

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

  /**
   * Chargé plutôt que référencé par `{ id }`, comme l'appartement : un id
   * inconnu doit répondre 404 au lieu d'une violation de clé étrangère en 500.
   * La liaison reste facultative, d'où le `null` accepté en entrée.
   */
  private async getResultForm(
    resultFormId?: number | null,
  ): Promise<ResultForm | null> {
    if (resultFormId == null) {
      return null;
    }

    const resultForm = await this.resultFormRepository.findOneBy({
      id: resultFormId,
    });

    if (!resultForm) {
      throw new NotFoundException(
        `ResultForm not found with id: ${resultFormId}`,
      );
    }

    return resultForm;
  }
}
