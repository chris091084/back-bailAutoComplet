import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthAccount } from './auth-account.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginThrottleService } from './login-throttle.service';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthAccount]),
    PassportModule,
    // Aucun secret par défaut : access et refresh sont signés avec des clés
    // distinctes, fournies explicitement à chaque appel de `signAsync`.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginThrottleService,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
  // Exportés pour que d'autres modules puissent poser JwtAuthGuard sur leurs
  // routes sans réenregistrer la stratégie.
  exports: [AuthService, PassportModule],
})
export class AuthModule {}
