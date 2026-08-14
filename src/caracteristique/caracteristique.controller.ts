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
import { CaracteristiqueService } from './caracteristique.service';
import { CaracteristiqueResponseDto } from './dto/caracteristique-response.dto';
import { UpsertCaracteristiqueDto } from './dto/upsert-caracteristique.dto';

@Controller('caracteristique')
export class CaracteristiqueController {
  constructor(
    private readonly caracteristiqueService: CaracteristiqueService,
  ) {}

  @Get()
  async getAllCaracteristique(): Promise<CaracteristiqueResponseDto[]> {
    const caracteristiques =
      await this.caracteristiqueService.getAllCaracteristique();
    return caracteristiques.map(
      (caracteristique) => new CaracteristiqueResponseDto(caracteristique),
    );
  }

  @Get(':appartementId')
  async getCaracteristiqueByAppartementId(
    @Param('appartementId', ParseIntPipe) appartementId: number,
  ): Promise<CaracteristiqueResponseDto[]> {
    const caracteristiques =
      await this.caracteristiqueService.getCaracteristiqueByAppartementId(
        appartementId,
      );
    return caracteristiques.map(
      (caracteristique) => new CaracteristiqueResponseDto(caracteristique),
    );
  }

  @Post()
  async createCaracteristique(
    @Body() body: UpsertCaracteristiqueDto,
  ): Promise<CaracteristiqueResponseDto> {
    return new CaracteristiqueResponseDto(
      await this.caracteristiqueService.createCaracteristique(body),
    );
  }

  @Put(':id')
  async updateCaracteristique(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CaracteristiqueResponseDto> {
    return new CaracteristiqueResponseDto(
      await this.caracteristiqueService.updateCaracteristique(id),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  deleteCaracteristique(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.caracteristiqueService.deleteCaracteristique(id);
  }
}
