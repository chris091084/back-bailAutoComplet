import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendMailDto } from './dto/send-mail.dto';
import { MailService } from './mail.service';

/**
 * Contrairement aux autres contrôleurs métier, celui-ci est protégé : un
 * endpoint d'envoi de mail laissé public serait un relais ouvert.
 *
 * `ValidationPipe` est posé ici car l'application n'en enregistre pas de global.
 */
@Controller('mail')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send')
  @HttpCode(204)
  send(@Body() body: SendMailDto): Promise<void> {
    return this.mailService.sendMail(body);
  }
}
