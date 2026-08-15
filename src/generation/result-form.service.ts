import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateResultFormDto } from './dto/create-generation.dto';
import { Generation } from './generation.entity';
import { ResultForm } from './result-form.entity';
import { appliquerResultFormDto } from './result-form.mapper';

/**
 * Le logement et le bailleur suffisent à présenter une saisie dans la liste des
 * brouillons, puis à la recharger dans le formulaire : les collections de
 * l'appartement (chambres, caractéristiques) sont relues côté front depuis
 * /appartement, inutile de les renvoyer ici.
 */
const RELATIONS_BROUILLON = { appartement: true, bailleur: true } as const;

/**
 * Les saisies de bail mises de côté : une ligne de `result_form` qu'aucune
 * génération ne référence encore. Elles permettent d'interrompre une saisie et
 * de la reprendre plus tard, sans créer ni document ni locataire.
 */
@Injectable()
export class ResultFormService {
  constructor(
    @InjectRepository(ResultForm)
    private readonly resultFormRepository: Repository<ResultForm>,
    @InjectRepository(Generation)
    private readonly generationRepository: Repository<Generation>,
  ) {}

  /**
   * `NOT EXISTS` plutôt qu'une colonne « brouillon » : l'état d'une saisie se
   * lit déjà dans le schéma, un bail généré est exactement un result_form
   * rattaché à une génération. Rien à maintenir en cohérence.
   *
   * La plus récente d'abord : c'est la saisie qu'on vient d'interrompre qu'on
   * revient chercher.
   */
  getBrouillons(): Promise<ResultForm[]> {
    return this.resultFormRepository
      .createQueryBuilder('resultForm')
      .leftJoinAndSelect('resultForm.appartement', 'appartement')
      .leftJoinAndSelect('resultForm.bailleur', 'bailleur')
      .where(
        `NOT EXISTS (
           SELECT 1 FROM "generation"
           WHERE "generation"."result_form_id" = "resultForm"."id"
         )`,
      )
      .orderBy('resultForm.id', 'DESC')
      .getMany();
  }

  async creerBrouillon(dto: CreateResultFormDto): Promise<ResultForm> {
    const brouillon = await this.resultFormRepository.save(
      appliquerResultFormDto(new ResultForm(), dto),
    );

    return this.getResultFormById(brouillon.id);
  }

  /**
   * Réenregistrer une saisie écrase la précédente plutôt que d'empiler les
   * lignes : c'est le même bail en cours de rédaction, pas un nouveau.
   */
  async majBrouillon(
    id: number,
    dto: CreateResultFormDto,
  ): Promise<ResultForm> {
    const brouillon = await this.getResultFormById(id);
    await this.refuserSiGenere(id);

    await this.resultFormRepository.save(
      appliquerResultFormDto(brouillon, dto),
    );

    return this.getResultFormById(id);
  }

  async supprimerBrouillon(id: number): Promise<void> {
    await this.getResultFormById(id);
    await this.refuserSiGenere(id);

    await this.resultFormRepository.delete(id);
  }

  private async getResultFormById(id: number): Promise<ResultForm> {
    const resultForm = await this.resultFormRepository.findOne({
      where: { id },
      relations: RELATIONS_BROUILLON,
    });

    if (!resultForm) {
      throw new NotFoundException(`ResultForm not found with id: ${id}`);
    }

    return resultForm;
  }

  /**
   * Un result_form déjà généré est la trace d'un bail remis au locataire : il
   * n'est ni modifiable ni supprimable, sous peine de réécrire l'historique et
   * de casser le lien que les fiches locataire gardent vers lui.
   *
   * Seule la génération est vérifiée : un locataire n'est créé qu'à partir d'un
   * bail généré (LocataireService), aucune fiche ne peut donc pointer vers un
   * brouillon.
   */
  private async refuserSiGenere(id: number): Promise<void> {
    const generations = await this.generationRepository.countBy({
      resultForm: { id },
    });

    if (generations > 0) {
      throw new ConflictException(
        `Le bail ${id} a déjà été généré : sa saisie n'est plus modifiable`,
      );
    }
  }
}
