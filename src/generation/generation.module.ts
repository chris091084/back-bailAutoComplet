import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenerationController } from './generation.controller';
import { Generation } from './generation.entity';
import { GenerationService } from './generation.service';
import { ResultForm } from './result-form.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Generation, ResultForm])],
  controllers: [GenerationController],
  providers: [GenerationService],
})
export class GenerationModule {}
