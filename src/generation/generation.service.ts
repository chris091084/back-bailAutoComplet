import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateGenerationDto,
  CreateResultFormDto,
} from './dto/create-generation.dto';
import { Generation } from './generation.entity';
import { ResultForm } from './result-form.entity';
import { appliquerResultFormDto } from './result-form.mapper';

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
   * La génération part du formulaire tel qu'il a été saisi : le même que celui
   * qu'enregistre POST /result-form, d'où la recopie partagée.
   */
  private buildResultForm(
    dto: CreateResultFormDto | null | undefined,
  ): ResultForm | null {
    return dto ? appliquerResultFormDto(new ResultForm(), dto) : null;
  }
}
