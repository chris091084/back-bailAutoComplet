import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { LocataireDto } from './dto/locataire.dto';
import { UpsertLocataireDto } from './dto/upsert-locataire.dto';
import { LocataireService } from './locataire.service';

@Controller('locataire')
export class LocataireController {
  constructor(private readonly locataireService: LocataireService) {}

  @Get()
  async getAllLocataires(): Promise<LocataireDto[]> {
    const locataires = await this.locataireService.getAllLocataires();
    return locataires.map((locataire) => new LocataireDto(locataire));
  }

  /**
   * Déclaré avant `:id` : Nest résout les routes dans l'ordre, un préfixe
   * statique placé après serait capturé par le paramètre.
   */
  @Get('appartement/:appartementId')
  async getLocatairesByAppartementId(
    @Param('appartementId', ParseIntPipe) appartementId: number,
  ): Promise<LocataireDto[]> {
    const locataires =
      await this.locataireService.findByAppartementId(appartementId);
    return locataires.map((locataire) => new LocataireDto(locataire));
  }

  @Get(':id')
  async getLocataireById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LocataireDto> {
    return new LocataireDto(await this.locataireService.getLocataireById(id));
  }

  @Post()
  async createLocataire(
    @Body() body: UpsertLocataireDto,
  ): Promise<LocataireDto> {
    return new LocataireDto(await this.locataireService.createLocataire(body));
  }

  @Put(':id')
  async updateLocataire(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpsertLocataireDto,
  ): Promise<LocataireDto> {
    return new LocataireDto(
      await this.locataireService.updateLocataire(id, body),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  deleteLocataire(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.locataireService.deleteLocataire(id);
  }
}
