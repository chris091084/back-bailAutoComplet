import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/guards/public.decorator';
import { edlFrontBaseUrl } from '../etat-des-lieux/edl-token.config';
import { OneDriveAuthService } from './onedrive-auth.service';
import { StatutOneDrive } from './onedrive.types';

/**
 * Administration de la connexion OneDrive, côté bailleur (session requise)…
 * sauf `callback`, que Microsoft appelle en redirigeant le navigateur : il n'y a
 * alors pas de session fiable (cookies `SameSite=strict` non envoyés lors d'une
 * redirection depuis un autre site). Sa protection est le `state` signé.
 */
@Controller('onedrive')
export class OneDriveController {
  constructor(private readonly auth: OneDriveAuthService) {}

  @Get('statut')
  statut(): Promise<StatutOneDrive> {
    return this.auth.statut();
  }

  /** URL de la page de consentement Microsoft : le front y envoie le navigateur. */
  @Get('autorisation')
  async autorisation(): Promise<{ url: string }> {
    return { url: await this.auth.urlAutorisation() };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') erreur: string | undefined,
    @Res() reponse: Response,
  ): Promise<void> {
    const retour = (statut: 'ok' | 'erreur'): string =>
      `${edlFrontBaseUrl()}/onedrive?statut=${statut}`;

    // L'utilisateur a refusé le consentement chez Microsoft.
    if (erreur) {
      reponse.redirect(retour('erreur'));
      return;
    }
    if (!code || !state) {
      throw new BadRequestException('Retour de connexion incomplet.');
    }

    try {
      await this.auth.connecterAvecCode(code, state);
      reponse.redirect(retour('ok'));
    } catch {
      reponse.redirect(retour('erreur'));
    }
  }

  @Delete('connexion')
  @HttpCode(204)
  deconnecter(): Promise<void> {
    return this.auth.deconnecter();
  }
}
