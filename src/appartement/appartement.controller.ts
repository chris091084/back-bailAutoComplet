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
import { Appartement } from './appartement.entity';
import { AppartementService } from './appartement.service';
import { AppartementDto } from './dto/appartement.dto';
import { RentRefDto } from './dto/rent-ref.dto';
import { ValIrlTIrlDto } from './dto/val-irl-tirl.dto';

@Controller('appartement')
export class AppartementController {
  constructor(private readonly appartementService: AppartementService) {}

  @Get()
  getAllAppartement(): Promise<AppartementDto[]> {
    return this.appartementService.getAllAppartement();
  }

  @Post('updateRent')
  postRentRefAndRentRefMaj(
    @Body() rentRefDto: RentRefDto,
  ): Promise<AppartementDto> {
    return this.appartementService.setRentRefAndRentRefMaj(rentRefDto);
  }

  @Post('updateValIrlTirl')
  postValIrlTirl(@Body() valIrlTIrlDto: ValIrlTIrlDto): Promise<void> {
    return this.appartementService.setValIrlTirl(valIrlTIrlDto);
  }

  @Get(':id')
  getAppartementById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AppartementDto> {
    return this.appartementService.getAppartementById(id);
  }

  @Post()
  createAppartement(
    @Body() appartement: Partial<Appartement>,
  ): Promise<AppartementDto> {
    return this.appartementService.createAppartement(appartement);
  }

  @Put(':id')
  updateAppartement(
    @Param('id', ParseIntPipe) id: number,
    @Body() appartement: Partial<Appartement>,
  ): Promise<AppartementDto> {
    return this.appartementService.updateAppartement(id, appartement);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteAppartement(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.appartementService.deleteAppartement(id);
  }
}
