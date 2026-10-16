import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppartementModule } from './appartement/appartement.module';
import { AuthModule } from './auth/auth.module';
import { BailleurModule } from './bailleur/bailleur.module';
import { CaracteristiqueModule } from './caracteristique/caracteristique.module';
import { ChambreModule } from './chambre/chambre.module';
import { buildTypeOrmOptions } from './database/typeorm-options';
import { DocumentsModule } from './documents/documents.module';
import { EtatDesLieuxModule } from './etat-des-lieux/etat-des-lieux.module';
import { GenerationModule } from './generation/generation.module';
import { HealthController } from './health/health.controller';
import { LocataireModule } from './locataire/locataire.module';
import { MailModule } from './mail/mail.module';
import { OneDriveModule } from './onedrive/onedrive.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Tâches planifiées (purge RGPD des états des lieux échus).
    ScheduleModule.forRoot(),
    // Quota par IP et par minute, appliqué à TOUTES les routes (voir le guard plus
    // bas). Chaque requête sert l'hébergeur à facturer du temps de calcul : c'est ce
    // qui borne la facture en cas de rafale. Les routes coûteuses ou sensibles
    // resserrent ce quota avec `@Throttle()`. Compteurs en mémoire, donc propres à
    // chaque instance : le plafond d'instances se règle chez l'hébergeur.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    TypeOrmModule.forRootAsync({ useFactory: buildTypeOrmOptions }),
    AuthModule,
    AppartementModule,
    BailleurModule,
    ChambreModule,
    CaracteristiqueModule,
    DocumentsModule,
    EtatDesLieuxModule,
    GenerationModule,
    LocataireModule,
    MailModule,
    OneDriveModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
