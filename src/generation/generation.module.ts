import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenerationController } from './generation.controller';
import { Generation } from './generation.entity';
import { GenerationService } from './generation.service';
import { ResultForm } from './result-form.entity';
import { ResultFormController } from './result-form.controller';
import { ResultFormService } from './result-form.service';

@Module({
  imports: [TypeOrmModule.forFeature([Generation, ResultForm])],
  controllers: [GenerationController, ResultFormController],
  providers: [GenerationService, ResultFormService],
})
export class GenerationModule {}
