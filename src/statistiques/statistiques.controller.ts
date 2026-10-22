import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { StatistiquesLocataires } from './statistiques.calcul';
import { StatistiquesService } from './statistiques.service';

/**
 * Protégée comme toutes les routes par la garde JWT globale : ces chiffres ne
 * sortent pas sans connexion. Ils ne contiennent aucun nom, seulement des nombres.
 */
@Controller('statistiques')
export class StatistiquesController {
  constructor(private readonly statistiques: StatistiquesService) {}

  /** `?appartementId=` restreint le calcul à un logement. */
  @Get('locataires')
  locataires(
    @Query('appartementId', new ParseIntPipe({ optional: true }))
    appartementId?: number,
  ): Promise<StatistiquesLocataires> {
    return this.statistiques.locataires(appartementId);
  }
}
