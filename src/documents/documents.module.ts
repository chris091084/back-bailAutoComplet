import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  // AuthModule réexporte PassportModule : sans lui, JwtAuthGuard ne trouve pas
  // la stratégie `jwt`. MailModule sert `POST /documents/envoyer`.
  imports: [AuthModule, MailModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
