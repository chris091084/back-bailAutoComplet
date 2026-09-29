import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthAccount } from './auth-account.entity';
import { AuthController } from './auth.controller';
import { PasskeyCredential } from './passkey-credential.entity';
import { PasskeyService } from './passkey.service';
import { AuthService } from './auth.service';
import { LoginThrottleService } from './login-throttle.service';
import { MagicLinkService } from './magic-link.service';
import { MailModule } from '../mail/mail.module';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthAccount, PasskeyCredential]),
    PassportModule,
    // Aucun secret par défaut : access et refresh sont signés avec des clés
    // distinctes, fournies explicitement à chaque appel de `signAsync`.
    JwtModule.register({}),
    // MailModule importe AuthModule (pour ses guards) : référence circulaire.
    forwardRef(() => MailModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasskeyService,
    MagicLinkService,
    LoginThrottleService,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
  // Exportés pour que d'autres modules puissent poser JwtAuthGuard sur leurs
  // routes sans réenregistrer la stratégie.
  exports: [AuthService, PasskeyService, PassportModule],
})
export class AuthModule {}
