import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { LocataireDto } from './dto/locataire.dto';
import { UpsertLocataireDto } from './dto/upsert-locataire.dto';
import { LocataireService } from './locataire.service';

@Controller('locataire')
export class LocataireController {
  constructor(private readonly locataireService: LocataireService) {}

  /**
   * `?sortis=true` bascule sur les locataires ayant quitté le logement. Un
   * paramètre plutôt qu'une seconde route : c'est la même liste, filtrée sur la
   * date de sortie.
   */
  @Get()
  async getAllLocataires(
    @Query('sortis', new DefaultValuePipe(false), ParseBoolPipe)
    sortis: boolean,
  ): Promise<LocataireDto[]> {
    const locataires = await this.locataireService.getAllLocataires(sortis);
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

  /**
   * Appelé par le front une fois la lettre de congé effectivement envoyée : la
   * date reste ainsi cohérente avec ce qui est parti, même si le mail échoue.
   */
  @Post(':id/resiliation')
  async marquerResiliationEnvoyee(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LocataireDto> {
    return new LocataireDto(
      await this.locataireService.marquerResiliationEnvoyee(id),
    );
  }

  /**
   * Sortie du logement, à la place de la suppression : un locataire parti reste
   * une pièce du dossier de l'appartement. La date est celle saisie dans la
   * modale, hors `updateLocataire` comme la résiliation — c'est un événement,
   * pas un champ de la fiche.
   */
  @Post(':id/sortie')
  async marquerSortie(
    @Param('id', ParseIntPipe) id: number,
    @Body('sortie') sortie?: string,
  ): Promise<LocataireDto> {
    return new LocataireDto(
      await this.locataireService.marquerSortie(id, sortie),
    );
  }

  /** Annule la sortie : le locataire retrouve la liste principale. */
  @Delete(':id/sortie')
  async reintegrerLocataire(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LocataireDto> {
    return new LocataireDto(
      await this.locataireService.reintegrerLocataire(id),
    );
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
}
