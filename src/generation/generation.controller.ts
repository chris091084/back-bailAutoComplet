import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { Generation } from './generation.entity';
import { GenerationService } from './generation.service';

@Controller('generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post()
  createGeneration(@Body() body: CreateGenerationDto): Promise<Generation> {
    return this.generationService.saveGeneration(body);
  }

  @Get()
  getAllGenerations(): Promise<Generation[]> {
    return this.generationService.getAllGenerations();
  }
}
