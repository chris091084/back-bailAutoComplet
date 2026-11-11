import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncadrementLoyersModule } from '../encadrement-loyers/encadrement-loyers.module';
import { IrlModule } from '../irl/irl.module';
import { AppartementController } from './appartement.controller';
import { Appartement } from './appartement.entity';
import { AppartementService } from './appartement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appartement]),
    IrlModule,
    EncadrementLoyersModule,
  ],
  controllers: [AppartementController],
  providers: [AppartementService],
})
export class AppartementModule {}
