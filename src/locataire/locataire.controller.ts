import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { LocataireDto } from './dto/locataire.dto';
import { UpsertLocataireDto } from './dto/upsert-locataire.dto';
import { EtatLocataire } from './locataire-etat.enum';
import { LocataireService } from './locataire.service';

@Controller('locataire')
export class LocataireController {
  constructor(private readonly locataireService: LocataireService) {}

  /**
   * `?etat=candidat|locataire|sorti` choisit l'onglet servi. Un paramètre
   * plutôt qu'une route par état : c'est la même liste, filtrée.
   *
   * Le défaut reste les locataires en place, ce qu'attend tout appel nu — dont
   * celui de la page appartements, qui n'a ainsi à compter ni les candidats ni
   * les sortis dans l'occupation d'un logement. Un état inconnu vaut 400, le
   * front n'en formant aucun à la main.
   */
  @Get()
  async getAllLocataires(
    @Query(
      'etat',
      new DefaultValuePipe(EtatLocataire.LOCATAIRE),
      new ParseEnumPipe(EtatLocataire),
    )
    etat: EtatLocataire,
  ): Promise<LocataireDto[]> {
    const locataires = await this.locataireService.getAllLocataires(etat);
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
   * Signature du bail : le candidat passe locataire et rejoint la liste
   * principale. Une route-événement comme la résiliation et la sortie, et non
   * un champ de `PUT /:id` — c'est un fait constaté, hors de portée de la
   * modale d'édition.
   */
  @Post(':id/signature')
  async signerBail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LocataireDto> {
    return new LocataireDto(await this.locataireService.signerBail(id));
  }

  /**
   * Appelé par le front une fois le projet de bail effectivement envoyé, sur le
   * même principe que `:id/resiliation` : la date suit ce qui est parti.
   */
  @Post(':id/bail')
  async marquerBailEnvoye(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LocataireDto> {
    return new LocataireDto(await this.locataireService.marquerBailEnvoye(id));
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
