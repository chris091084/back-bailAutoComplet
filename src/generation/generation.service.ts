import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { Bailleur } from '../bailleur/bailleur.entity';
import {
  CreateGenerationDto,
  CreateResultFormDto,
  ReferenceDto,
} from './dto/create-generation.dto';
import { Generation } from './generation.entity';
import { ResultForm } from './result-form.entity';

/**
 * Relations chargées pour reproduire ce que renvoyait l'API Java : `resultForm`
 * (@OneToOne, EAGER par défaut) puis ses `appartement`/`bailleur` (@ManyToOne,
 * EAGER également), les collections de l'appartement étant hydratées à la
 * sérialisation grâce à `spring.jpa.open-in-view`.
 */
const RELATIONS_COMPLETES = {
  resultForm: {
    appartement: {
      bailleur: true,
      chambres: true,
      caracteristiques: true,
    },
    bailleur: true,
  },
} as const;

@Injectable()
export class GenerationService {
  constructor(
    @InjectRepository(Generation)
    private readonly generationRepository: Repository<Generation>,
  ) {}

  async saveGeneration(dto: CreateGenerationDto): Promise<Generation> {
    const generation = this.generationRepository.create({
      // Hibernate générait l'UUID côté application (GenerationType.UUID).
      id: dto.id ?? randomUUID(),
      date: dto.date as unknown as Date,
      appartementName: dto.appartementName,
      locataireName: dto.locataireName,
      resultForm: this.buildResultForm(dto.resultForm),
    });

    const saved = await this.generationRepository.save(generation);

    return this.getGenerationById(saved.id);
  }

  getAllGenerations(): Promise<Generation[]> {
    return this.generationRepository.find({ relations: RELATIONS_COMPLETES });
  }

  private async getGenerationById(id: string): Promise<Generation> {
    const generation = await this.generationRepository.findOne({
      where: { id },
      relations: RELATIONS_COMPLETES,
    });

    // La génération vient d'être écrite dans la même requête : elle existe.
    return generation as Generation;
  }

  /**
   * `appartement` et `bailleur` sont réduits à leur identifiant : côté Java ces
   * relations n'avaient pas de cascade, un POST /generation ne pouvait donc pas
   * modifier l'appartement ni le bailleur référencés.
   */
  private buildResultForm(
    dto: CreateResultFormDto | null | undefined,
  ): ResultForm | null {
    if (!dto) {
      return null;
    }

    const resultForm = new ResultForm();

    resultForm.adress = dto.adress ?? null;
    resultForm.appartement = this.toReference<Appartement>(dto.appartement);
    resultForm.chargePrice = dto.chargePrice ?? null;
    resultForm.email = dto.email ?? null;
    resultForm.firstname = dto.firstname ?? null;
    resultForm.from = dto.from ?? null;
    resultForm.to = dto.to ?? null;
    resultForm.motif = dto.motif ?? null;
    resultForm.name = dto.name ?? null;
    resultForm.priceNoCharge = dto.priceNoCharge ?? null;
    resultForm.room = dto.room ?? null;
    resultForm.telephone = dto.telephone ?? null;
    resultForm.bailleur = this.toReference<Bailleur>(dto.bailleur);
    resultForm.bailType = dto.bailType ?? null;
    resultForm.tIrl = dto.tIrl ?? null;
    resultForm.valIrl = dto.valIrl ?? null;
    resultForm.lastPriceWithoutCharge = dto.lastPriceWithoutCharge ?? null;
    resultForm.chargeList = dto.chargeList ?? null;
    resultForm.clauseLess6Month = dto.clauseLess6Month ?? null;
    resultForm.typeResidence = dto.typeResidence ?? null;
    resultForm.rentRef = dto.rentRef ?? null;
    resultForm.rentRefMaj = dto.rentRefMaj ?? null;

    return resultForm;
  }

  private toReference<T>(reference: ReferenceDto | null | undefined): T | null {
    return reference?.id != null ? ({ id: reference.id } as T) : null;
  }
}
