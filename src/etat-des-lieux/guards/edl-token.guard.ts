import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import {
  CODE_LIEN_EXPIRE,
  CODE_LIEN_INVALIDE,
  EdlTokenService,
} from '../edl-token.service';
import { EtatDesLieux } from '../etat-des-lieux.entity';
import { StatutEtatDesLieux } from '../etat-des-lieux.enums';

/** Ce que le garde dépose sur la requête une fois le lien accepté. */
export interface EdlCourant {
  id: string;
  statut: StatutEtatDesLieux;
}

export type RequeteAvecEdl = Request & { edl?: EdlCourant };

/** Code renvoyé quand une écriture arrive sur un document déjà signé. */
export const CODE_DEJA_SIGNE = 'DEJA_SIGNE';

const METHODES_LECTURE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Garde des routes `/etats-des-lieux/:token/...`, toutes marquées `@Public()`
 * pour échapper à la session du bailleur : ici, c'est le JETON qui authentifie.
 *
 * Il vérifie dans l'ordre :
 *   1. la signature et l'expiration du JWT ;
 *   2. que le document existe et que la version du lien (`jti`) est la
 *      courante — un lien régénéré invalide les précédents ;
 *   3. pour toute ÉCRITURE, que le document n'est pas déjà signé.
 */
@Injectable()
export class EdlTokenGuard implements CanActivate {
  constructor(
    private readonly tokens: EdlTokenService,
    @InjectRepository(EtatDesLieux)
    private readonly repository: Repository<EtatDesLieux>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requete = context.switchToHttp().getRequest<RequeteAvecEdl>();
    const token = requete.params['token'];

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException({
        message: 'Lien invalide.',
        code: CODE_LIEN_INVALIDE,
      });
    }

    const { edlId, jti } = await this.tokens.verifier(token);

    const edl = await this.repository.findOne({
      where: { id: edlId },
      select: { id: true, statut: true, lienJti: true, lienExpireLe: true },
    });

    if (!edl || edl.lienJti !== jti) {
      throw new UnauthorizedException({
        message: 'Lien invalide.',
        code: CODE_LIEN_INVALIDE,
      });
    }

    if (edl.lienExpireLe.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        message: 'Ce lien a expiré. Demandez-en un nouveau au bailleur.',
        code: CODE_LIEN_EXPIRE,
      });
    }

    if (
      !METHODES_LECTURE.has(requete.method) &&
      edl.statut === StatutEtatDesLieux.SIGNED
    ) {
      throw new ConflictException({
        message: 'Ce document est déjà signé : il ne peut plus être modifié.',
        code: CODE_DEJA_SIGNE,
      });
    }

    requete.edl = { id: edl.id, statut: edl.statut };
    return true;
  }
}

/** `@EdlActuel()` : le document désigné par le lien, déposé par le garde. */
export const EdlActuel = createParamDecorator(
  (_donnee: unknown, context: ExecutionContext): EdlCourant => {
    const requete = context.switchToHttp().getRequest<RequeteAvecEdl>();

    if (!requete.edl) {
      // Ne devrait jamais arriver : la route a oublié `@UseGuards(EdlTokenGuard)`.
      throw new UnauthorizedException();
    }

    return requete.edl;
  },
);
