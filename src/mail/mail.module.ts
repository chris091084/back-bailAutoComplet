import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Module({
  // AuthModule réexporte PassportModule : sans lui, JwtAuthGuard ne trouve pas
  // la stratégie `jwt`. AuthModule importe à son tour MailModule (lien magique) :
  // la référence circulaire se résout par forwardRef des deux côtés.
  imports: [forwardRef(() => AuthModule)],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
