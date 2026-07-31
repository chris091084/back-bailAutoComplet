import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppartementModule } from './appartement/appartement.module';
import { BailleurModule } from './bailleur/bailleur.module';
import { CaracteristiqueModule } from './caracteristique/caracteristique.module';
import { ChambreModule } from './chambre/chambre.module';
import { buildTypeOrmOptions } from './database/typeorm-options';
import { GenerationModule } from './generation/generation.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useFactory: buildTypeOrmOptions }),
    AppartementModule,
    BailleurModule,
    ChambreModule,
    CaracteristiqueModule,
    GenerationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
