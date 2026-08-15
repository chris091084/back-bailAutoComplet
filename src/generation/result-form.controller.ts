import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CreateResultFormDto } from './dto/create-generation.dto';
import { ResultForm } from './result-form.entity';
import { ResultFormService } from './result-form.service';

/**
 * Les saisies de bail enregistrées sans génération. POST /generation reste la
 * seule porte d'entrée d'un bail réellement produit : ici on ne fait qu'écrire
 * la ligne de `result_form`, sans document ni fiche locataire.
 */
@Controller('result-form')
export class ResultFormController {
  constructor(private readonly resultFormService: ResultFormService) {}

  /**
   * Déclaré avant toute route paramétrée : Nest résout les routes dans l'ordre,
   * un préfixe statique placé après serait capturé par le paramètre.
   */
  @Get('brouillons')
  getBrouillons(): Promise<ResultForm[]> {
    return this.resultFormService.getBrouillons();
  }

  @Post()
  creerBrouillon(@Body() body: CreateResultFormDto): Promise<ResultForm> {
    return this.resultFormService.creerBrouillon(body);
  }

  @Put(':id')
  majBrouillon(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateResultFormDto,
  ): Promise<ResultForm> {
    return this.resultFormService.majBrouillon(id, body);
  }

  @Delete(':id')
  supprimerBrouillon(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.resultFormService.supprimerBrouillon(id);
  }
}
