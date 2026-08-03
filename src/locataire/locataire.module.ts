import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appartement } from '../appartement/appartement.entity';
import { LocataireController } from './locataire.controller';
import { Locataire } from './locataire.entity';
import { LocataireService } from './locataire.service';

@Module({
  imports: [TypeOrmModule.forFeature([Locataire, Appartement])],
  controllers: [LocataireController],
  providers: [LocataireService],
})
export class LocataireModule {}
