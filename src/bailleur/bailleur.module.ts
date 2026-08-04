import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BailleurController } from './bailleur.controller';
import { Bailleur } from './bailleur.entity';
import { BailleurService } from './bailleur.service';

@Module({
  imports: [TypeOrmModule.forFeature([Bailleur])],
  controllers: [BailleurController],
  providers: [BailleurService],
})
export class BailleurModule {}
