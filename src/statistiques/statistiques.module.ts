import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Locataire } from '../locataire/locataire.entity';
import { StatistiquesController } from './statistiques.controller';
import { StatistiquesService } from './statistiques.service';

@Module({
  imports: [TypeOrmModule.forFeature([Locataire])],
  controllers: [StatistiquesController],
  providers: [StatistiquesService],
})
export class StatistiquesModule {}
