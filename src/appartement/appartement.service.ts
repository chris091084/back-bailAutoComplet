import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IrlDto } from '../irl/dto/irl.dto';
import { IrlService } from '../irl/irl.service';
import { Appartement } from './appartement.entity';
import { AppartementDto } from './dto/appartement.dto';
import { RENT_REF, RentRefDto } from './dto/rent-ref.dto';
import { VAL_IRL, ValIrlTIrlDto } from './dto/val-irl-tirl.dto';

/**
 * Les appartements 1 et 4 sont deux logements de la même résidence (Filature) :
 * leurs loyers de référence doivent rester alignés.
 */
const GROUPE_FILATURE: readonly number[] = [1, 4];

@Injectable()
export class AppartementService {
  constructor(
    @InjectRepository(Appartement)
    private readonly appartementRepository: Repository<Appartement>,
    private readonly irlService: IrlService,
  ) {}

  async getAllAppartement(): Promise<AppartementDto[]> {
    const appartements = await this.appartementRepository.find({
      relations: { chambres: true, caracteristiques: true },
      order: { id: 'ASC' },
    });

    if (appartements.length === 0) {
      throw new NotFoundException("pas d'appartement disponible");
    }

    // On ne récupère l'IRL qu'une fois pour toute la liste (mis en cache dans
    // IrlService).
    const latestIrl = await this.irlService.getLatestIrl();

    for (const appartement of appartements) {
      await this.applyLatestIrl(appartement, latestIrl);
    }

    return appartements.map((appartement) => new AppartementDto(appartement));
  }

  async getAppartementById(id: number): Promise<AppartementDto> {
    const appartement = await this.findOneOrFail(id);

    // Tant que l'IRL n'a pas été saisi à la main, on le remplit avec la
    // dernière valeur publiée par l'INSEE. En cas d'échec de l'API, on garde la
    // valeur en base.
    await this.applyLatestIrl(
      appartement,
      await this.irlService.getLatestIrl(),
    );

    return new AppartementDto(appartement);
  }

  async createAppartement(
    appartement: Partial<Appartement>,
  ): Promise<AppartementDto> {
    const saved = await this.appartementRepository.save(
      this.appartementRepository.create(appartement),
    );

    return new AppartementDto(saved);
  }

  async updateAppartement(
    id: number,
    details: Partial<Appartement>,
  ): Promise<AppartementDto> {
    await this.findOneOrFail(id);

    const modifications: Partial<Appartement> = {};

    if (details.valIrl != null) {
      modifications.valIrl = details.valIrl;
    }
    if (details.tIrl != null) {
      modifications.tIrl = details.tIrl;
    }

    // Une saisie manuelle (valeur non vide) fige l'IRL ; une valeur vide
    // rebascule vers le remplissage automatique depuis l'INSEE lors du
    // prochain GET.
    if (details.valIrl != null || details.tIrl != null) {
      modifications.irlManual =
        (details.valIrl != null && details.valIrl.trim() !== '') ||
        (details.tIrl != null && details.tIrl.trim() !== '');
    }

    await this.appliquerModifications(id, modifications);

    return new AppartementDto(await this.findOneOrFail(id));
  }

  async deleteAppartement(id: number): Promise<void> {
    if (!(await this.appartementRepository.existsBy({ id }))) {
      throw new NotFoundException(`Appartement not found with id: ${id}`);
    }

    // Reproduit le cascade ALL + orphanRemoval de l'entité JPA : les enfants
    // doivent partir avant le parent, la contrainte FK n'étant pas en cascade.
    await this.appartementRepository.manager.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM "caracteristique" WHERE "appartement_id" = $1`,
        [id],
      );
      await manager.query(`DELETE FROM "chambre" WHERE "appartement_id" = $1`, [
        id,
      ]);
      await manager.query(`DELETE FROM "appartement" WHERE "id" = $1`, [id]);
    });
  }

  async setRentRefAndRentRefMaj(
    rentRefDto: RentRefDto,
  ): Promise<AppartementDto> {
    const id = rentRefDto.idAppartement;

    if (!(await this.appartementRepository.existsBy({ id }))) {
      throw new NotFoundException(
        `L'appartement avec l'id ${id} n'a pas été trouvé.`,
      );
    }

    await this.appliquerModifications(id, this.champRentRef(rentRefDto));
    await this.syncFilatureGroup(id, rentRefDto);

    return new AppartementDto(await this.findOneOrFail(id));
  }

  async setValIrlTirl(valIrlTIrlDto: ValIrlTIrlDto): Promise<void> {
    // Une saisie manuelle non vide passe l'IRL en mode « manuel » ; une valeur
    // vide/nulle rebascule vers le remplissage automatique depuis l'INSEE.
    const manual =
      valIrlTIrlDto.value != null && valIrlTIrlDto.value.trim() !== '';
    const colonne = valIrlTIrlDto.fieldName === VAL_IRL ? 'valIrl' : 'tIrl';

    // Mise à jour de tous les appartements, sans clause WHERE : c'est le
    // comportement des requêtes @Modifying du AppartementRepository Java.
    await this.appartementRepository
      .createQueryBuilder()
      .update(Appartement)
      .set({ [colonne]: valIrlTIrlDto.value, irlManual: manual })
      .execute();
  }

  /**
   * Remplit valIrl/tIrl avec la dernière valeur INSEE tant que l'IRL n'a pas
   * été saisi à la main (`irlManual`). Persiste la mise à jour le cas échéant.
   */
  private async applyLatestIrl(
    appartement: Appartement,
    latestIrl: IrlDto | null,
  ): Promise<void> {
    if (appartement.irlManual || latestIrl === null) {
      return;
    }

    // L'API Java réécrivait la ligne à chaque lecture ; on n'écrit que si la
    // valeur a réellement changé.
    if (
      appartement.valIrl === latestIrl.valIrl &&
      appartement.tIrl === latestIrl.tIrl
    ) {
      return;
    }

    appartement.valIrl = latestIrl.valIrl;
    appartement.tIrl = latestIrl.tIrl;

    await this.appartementRepository.update(appartement.id, {
      valIrl: latestIrl.valIrl,
      tIrl: latestIrl.tIrl,
    });
  }

  /**
   * Écrit uniquement les colonnes concernées.
   *
   * `save()` est volontairement évité ici : l'appartement est chargé avec ses
   * chambres et caractéristiques, et TypeORM propagerait l'écriture à ces
   * collections en remettant leur `appartement_id` à NULL.
   */
  private async appliquerModifications(
    id: number,
    modifications: Partial<Appartement>,
  ): Promise<void> {
    if (Object.keys(modifications).length === 0) {
      return;
    }

    await this.appartementRepository.update(id, modifications);
  }

  /**
   * Reprend telle quelle la condition du service Java : seul un `rentRef`
   * accompagné d'une valeur non nulle alimente la colonne rent_ref, tout le
   * reste (y compris un rentRef à null) atterrit sur rent_ref_maj.
   */
  private champRentRef(rentRefDto: RentRefDto): Partial<Appartement> {
    return rentRefDto.value != null && rentRefDto.fieldName === RENT_REF
      ? { rentRef: rentRefDto.value }
      : { rentRefMaj: rentRefDto.value };
  }

  private async syncFilatureGroup(
    courantId: number,
    rentRefDto: RentRefDto,
  ): Promise<void> {
    if (!GROUPE_FILATURE.includes(courantId)) {
      return;
    }

    const cibleId = GROUPE_FILATURE.find((id) => id !== courantId);

    if (cibleId === undefined) {
      return;
    }

    const autre = await this.appartementRepository.findOneBy({ id: cibleId });

    if (!autre) {
      return;
    }

    const estRentRef =
      rentRefDto.value != null && rentRefDto.fieldName === RENT_REF;
    const valeurActuelle = estRentRef ? autre.rentRef : autre.rentRefMaj;

    if (valeurActuelle === rentRefDto.value) {
      return;
    }

    await this.appliquerModifications(cibleId, this.champRentRef(rentRefDto));
  }

  private async findOneOrFail(id: number): Promise<Appartement> {
    const appartement = await this.appartementRepository.findOne({
      where: { id },
      relations: { chambres: true, caracteristiques: true },
    });

    if (!appartement) {
      throw new NotFoundException(`Appartement not found with id: ${id}`);
    }

    return appartement;
  }
}
