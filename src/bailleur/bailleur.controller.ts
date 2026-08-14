import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Bailleur } from './bailleur.entity';
import { BailleurService } from './bailleur.service';

@Controller('bailleur')
export class BailleurController {
  constructor(private readonly bailleurService: BailleurService) {}

  @Get()
  getAllBailleurs(): Promise<Bailleur[]> {
    return this.bailleurService.getAllBailleurs();
  }

  @Get(':id')
  async getBailleurById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Bailleur> {
    const bailleur = await this.bailleurService.getBailleurById(id);

    if (!bailleur) {
      throw new NotFoundException();
    }

    return bailleur;
  }

  @Post()
  createBailleur(@Body() bailleur: Partial<Bailleur>): Promise<Bailleur> {
    return this.bailleurService.createBailleur(bailleur);
  }

  @Put(':id')
  updateBailleur(
    @Param('id', ParseIntPipe) id: number,
    @Body() bailleur: Partial<Bailleur>,
  ): Promise<Bailleur> {
    return this.bailleurService.updateBailleur(id, bailleur);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteBailleur(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.bailleurService.deleteBailleur(id);
  }
}
