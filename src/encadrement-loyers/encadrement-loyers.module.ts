import { Module } from '@nestjs/common';
import { EncadrementLoyersService } from './encadrement-loyers.service';

@Module({
  providers: [EncadrementLoyersService],
  exports: [EncadrementLoyersService],
})
export class EncadrementLoyersModule {}
