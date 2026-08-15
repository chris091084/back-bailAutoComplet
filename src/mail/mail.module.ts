import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Module({
  // AuthModule réexporte PassportModule : sans lui, JwtAuthGuard ne trouve pas
  // la stratégie `jwt`.
  imports: [AuthModule],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
