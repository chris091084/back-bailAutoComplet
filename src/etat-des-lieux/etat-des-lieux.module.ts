import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Locataire } from '../locataire/locataire.entity';
import { MailModule } from '../mail/mail.module';
import { OneDriveModule } from '../onedrive/onedrive.module';
import { EdlElementHistorique } from './edl-element-historique.entity';
import { EdlElement } from './edl-element.entity';
import { EdlPdfService } from './edl-pdf.service';
import { EdlRetentionService } from './edl-retention.service';
import { EdlRgpdService } from './edl-rgpd.service';
import { RgpdController } from './rgpd.controller';
import { EdlPhotoService } from './edl-photo.service';
import { EdlSignatureService } from './edl-signature.service';
import { EdlPhoto } from './edl-photo.entity';
import { EdlPiece } from './edl-piece.entity';
import { EdlTokenService } from './edl-token.service';
import { EtatDesLieuxPublicController } from './etat-des-lieux-public.controller';
import { EtatDesLieux } from './etat-des-lieux.entity';
import { EtatDesLieuxController } from './etat-des-lieux.controller';
import { EtatDesLieuxService } from './etat-des-lieux.service';
import { EdlTokenGuard } from './guards/edl-token.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EtatDesLieux,
      EdlPiece,
      EdlElement,
      EdlPhoto,
      EdlElementHistorique,
      Locataire,
    ]),
    // Aucune clé par défaut : chaque signature/vérification fournit la sienne
    // (EDL_TOKEN_SECRET), distincte de celles de la session.
    JwtModule.register({}),
    OneDriveModule,
    MailModule,
  ],
  controllers: [
    EtatDesLieuxController,
    EtatDesLieuxPublicController,
    RgpdController,
  ],
  providers: [
    EtatDesLieuxService,
    EdlPhotoService,
    EdlPdfService,
    EdlSignatureService,
    EdlRetentionService,
    EdlRgpdService,
    EdlTokenService,
    EdlTokenGuard,
  ],
  exports: [EtatDesLieuxService, EdlTokenService],
})
export class EtatDesLieuxModule {}
