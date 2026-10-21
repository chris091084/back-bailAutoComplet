import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { Appartement } from '../appartement/appartement.entity';
import { ResultForm } from '../generation/result-form.entity';
import { LocataireController } from './locataire.controller';
import { Locataire } from './locataire.entity';
import { LocatairePurgeService } from './locataire-purge.service';
import { LocataireService } from './locataire.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Locataire, Appartement, ResultForm]),
    MailModule,
  ],
  controllers: [LocataireController],
  providers: [LocataireService, LocatairePurgeService],
})
export class LocataireModule {}
