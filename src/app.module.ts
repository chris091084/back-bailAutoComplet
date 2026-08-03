import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppartementModule } from './appartement/appartement.module';
import { AuthModule } from './auth/auth.module';
import { BailleurModule } from './bailleur/bailleur.module';
import { CaracteristiqueModule } from './caracteristique/caracteristique.module';
import { ChambreModule } from './chambre/chambre.module';
import { buildTypeOrmOptions } from './database/typeorm-options';
import { GenerationModule } from './generation/generation.module';
import { HealthController } from './health/health.controller';
import { LocataireModule } from './locataire/locataire.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useFactory: buildTypeOrmOptions }),
    AuthModule,
    AppartementModule,
    BailleurModule,
    ChambreModule,
    CaracteristiqueModule,
    GenerationModule,
    LocataireModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
