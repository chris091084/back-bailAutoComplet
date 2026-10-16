import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  EdlRetentionService,
  ResultatEffacement,
  ResultatPurge,
} from './edl-retention.service';
import { EdlRgpdService, ExportLocataire } from './edl-rgpd.service';

/**
 * Droits RGPD et rétention, réservés au bailleur (session requise : aucun
 * `@Public()` ici, le guard global ferme la route).
 */
@Controller('rgpd/etats-des-lieux')
export class RgpdController {
  constructor(
    private readonly rgpd: EdlRgpdService,
    private readonly retention: EdlRetentionService,
  ) {}

  /** Droit d'accès / portabilité : tout ce que le module détient sur ce locataire. */
  @Get('locataire/:id/export')
  @Header(
    'Content-Disposition',
    'attachment; filename="export-etats-des-lieux.json"',
  )
  exporter(@Param('id', ParseIntPipe) id: number): Promise<ExportLocataire> {
    return this.rgpd.exporter(id);
  }

  /** Droit à l'effacement : documents, photos et PDF OneDrive du locataire. */
  @Delete('locataire/:id')
  @HttpCode(200)
  effacer(@Param('id', ParseIntPipe) id: number): Promise<ResultatEffacement> {
    return this.rgpd.effacer(id);
  }

  /** Lance la purge des documents échus à la main. `?simulation=true` : compte sans rien supprimer. */
  @Post('retention/purger')
  @HttpCode(200)
  purger(@Query('simulation') simulation?: string): Promise<ResultatPurge> {
    return this.retention.purger({ simulation: simulation === 'true' });
  }
}
