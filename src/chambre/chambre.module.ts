import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChambreController } from './chambre.controller';
import { Chambre } from './chambre.entity';
import { ChambreService } from './chambre.service';

@Module({
  imports: [TypeOrmModule.forFeature([Chambre])],
  controllers: [ChambreController],
  providers: [ChambreService],
})
export class ChambreModule {}
