import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  // AuthModule réexporte PassportModule : sans lui, JwtAuthGuard ne trouve pas
  // la stratégie `jwt`.
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
