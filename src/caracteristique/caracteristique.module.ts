import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaracteristiqueController } from './caracteristique.controller';
import { Caracteristique } from './caracteristique.entity';
import { CaracteristiqueService } from './caracteristique.service';

@Module({
  imports: [TypeOrmModule.forFeature([Caracteristique])],
  controllers: [CaracteristiqueController],
  providers: [CaracteristiqueService],
})
export class CaracteristiqueModule {}
