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
import { ChambreService } from './chambre.service';
import { ChambreResponseDto } from './dto/chambre-response.dto';
import { UpsertChambreDto } from './dto/upsert-chambre.dto';

@Controller('chambre')
export class ChambreController {
  constructor(private readonly chambreService: ChambreService) {}

  @Get()
  async getAllChambres(): Promise<ChambreResponseDto[]> {
    const chambres = await this.chambreService.getAllChambres();
    return chambres.map((chambre) => new ChambreResponseDto(chambre));
  }

  @Get(':id')
  async getChambreById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ChambreResponseDto> {
    return new ChambreResponseDto(await this.chambreService.getChambreById(id));
  }

  @Post()
  async createChambre(
    @Body() body: UpsertChambreDto,
  ): Promise<ChambreResponseDto> {
    return new ChambreResponseDto(
      await this.chambreService.createChambre(body),
    );
  }

  @Put(':id')
  async updateChambre(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpsertChambreDto,
  ): Promise<ChambreResponseDto> {
    return new ChambreResponseDto(
      await this.chambreService.updateChambre(id, body),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  deleteChambre(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.chambreService.deleteChambre(id);
  }
}
