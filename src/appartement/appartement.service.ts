import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncadrementLoyersService } from '../encadrement-loyers/encadrement-loyers.service';
import { IrlDto } from '../irl/dto/irl.dto';
import { IrlService } from '../irl/irl.service';
import { Appartement } from './appartement.entity';
import { AppartementDto } from './dto/appartement.dto';
import { RENT_REF, RENT_REF_MAJ, RentRefDto } from './dto/rent-ref.dto';
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
    private readonly encadrementLoyersService: EncadrementLoyersService,
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

    // Les requêtes vers l'encadrement des loyers sont mises en cache et
    // regroupées par adresse : on peut les lancer en parallèle.
    await Promise.all(
      appartements.map((appartement) => this.applyLatestRentRef(appartement)),
    );

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

    await this.applyLatestRentRef(appartement);

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
    const existant = await this.findOneOrFail(id);

    const modifications: Partial<Appartement> = {};

    // Seuls les loyers sont éditables depuis la modale du front ; nom, adresse,
    // propriétaire et surface sont figés. Un champ absent du corps n'est pas
    // remis à null.
    for (const champ of ['rentRef', 'rentRefMaj'] as const) {
      if (details[champ] !== undefined) {
        modifications[champ] = this.versNombre(details[champ]);
      }
    }

    // Le front envoie le mode choisi (interrupteur automatique / manuel). En
    // automatique, les valeurs reçues ne sont que l'écho de celles en base : on
    // ne les écrit pas, elles seront remplacées par celles de l'encadrement.
    // Sans mode explicite, on le déduit : une valeur modifiée à la main fige les
    // loyers, vider un champ rebascule en automatique, des valeurs inchangées
    // ne changent rien.
    const manuel =
      typeof details.rentRefManual === 'boolean'
        ? details.rentRefManual
        : this.rentRefManuel(existant, modifications);
    if (manuel === false && typeof details.rentRefManual === 'boolean') {
      delete modifications.rentRef;
      delete modifications.rentRefMaj;
    }
    if (manuel !== undefined) {
      modifications.rentRefManual = manuel;
    }

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
    if (manuel !== undefined) {
      await this.syncManuelFilature(id, manuel);
    }

    // Même alignement des loyers de référence que via `updateRent`.
    if (modifications.rentRef != null) {
      await this.syncFilatureGroup(id, {
        idAppartement: id,
        fieldName: RENT_REF,
        value: modifications.rentRef,
      });
    }
    if (modifications.rentRefMaj !== undefined) {
      await this.syncFilatureGroup(id, {
        idAppartement: id,
        fieldName: RENT_REF_MAJ,
        value: modifications.rentRefMaj,
      });
    }

    // Si les loyers viennent de repasser en automatique, on les remplit tout de
    // suite plutôt qu'à la prochaine lecture.
    const misAJour = await this.findOneOrFail(id);
    await this.applyLatestRentRef(misAJour);

    return new AppartementDto(misAJour);
  }

  /** Accepte un nombre ou une saisie texte (« 10,7 ») ; vide → null. */
  private versNombre(valeur: unknown): number | null {
    if (valeur === null || valeur === '') {
      return null;
    }
    const nombre = Number(String(valeur).replace(',', '.'));
    if (Number.isNaN(nombre)) {
      throw new BadRequestException(`Valeur numérique invalide : ${valeur}`);
    }
    return nombre;
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

    // Même règle que l'IRL : une saisie non vide fige les loyers, une valeur
    // vide les rebascule en automatique.
    const manuel = rentRefDto.value != null;
    await this.appliquerModifications(id, {
      ...this.champRentRef(rentRefDto),
      rentRefManual: manuel,
    });
    await this.syncFilatureGroup(id, rentRefDto);
    await this.syncManuelFilature(id, manuel);

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
   * Remplit rentRef/rentRefMaj avec les loyers de l'encadrement des loyers tant
   * qu'ils n'ont pas été saisis à la main (`rentRefManual`). Persiste la mise à
   * jour le cas échéant ; si l'API est injoignable, la valeur en base est
   * conservée.
   */
  private async applyLatestRentRef(appartement: Appartement): Promise<void> {
    if (appartement.rentRefManual) {
      return;
    }

    const loyers = await this.encadrementLoyersService.getLoyersReference(
      appartement.adress,
      appartement.constructionPeriod ?? null,
    );

    if (
      loyers === null ||
      (appartement.rentRef === loyers.rentRef &&
        appartement.rentRefMaj === loyers.rentRefMaj)
    ) {
      return;
    }

    appartement.rentRef = loyers.rentRef;
    appartement.rentRefMaj = loyers.rentRefMaj;

    await this.appartementRepository.update(appartement.id, {
      rentRef: loyers.rentRef,
      rentRefMaj: loyers.rentRefMaj,
    });
  }

  /**
   * @returns `true` si l'un des loyers soumis diffère de la valeur stockée,
   * `false` si l'un a été vidé (retour à l'automatique), `undefined` si rien
   * n'a changé.
   */
  private rentRefManuel(
    existant: Appartement,
    modifications: Partial<Appartement>,
  ): boolean | undefined {
    let vide = false;

    for (const champ of ['rentRef', 'rentRefMaj'] as const) {
      const soumis = modifications[champ];
      if (soumis === undefined) {
        continue;
      }
      if (soumis === null) {
        vide = true;
      } else if (soumis !== existant[champ]) {
        return true;
      }
    }

    return vide ? false : undefined;
  }

  /** Les logements d'une même résidence partagent le mode manuel/automatique. */
  private async syncManuelFilature(
    courantId: number,
    manuel: boolean,
  ): Promise<void> {
    if (!GROUPE_FILATURE.includes(courantId)) {
      return;
    }

    const cibleId = GROUPE_FILATURE.find((id) => id !== courantId);

    if (cibleId !== undefined) {
      await this.appliquerModifications(cibleId, { rentRefManual: manuel });
    }
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
