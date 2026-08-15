import { Module } from '@nestjs/common';
import { IrlService } from './irl.service';

@Module({
  providers: [IrlService],
  exports: [IrlService],
})
export class IrlModule {}
