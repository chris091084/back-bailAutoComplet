import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrlModule } from '../irl/irl.module';
import { AppartementController } from './appartement.controller';
import { Appartement } from './appartement.entity';
import { AppartementService } from './appartement.service';

@Module({
  imports: [TypeOrmModule.forFeature([Appartement]), IrlModule],
  controllers: [AppartementController],
  providers: [AppartementService],
})
export class AppartementModule {}
