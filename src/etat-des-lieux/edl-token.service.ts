import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  EDL_TOKEN_AUDIENCE,
  edlFrontBaseUrl,
  edlTokenSecret,
  edlTokenSecretConfigure,
} from './edl-token.config';

/** Ce que le jeton affirme, une fois sa signature et son expiration vérifiées. */
export interface ContenuJetonEdl {
  edlId: string;
  jti: string;
}

/** Codes lisibles par le front pour choisir le message affiché au locataire. */
export const CODE_LIEN_INVALIDE = 'LIEN_INVALIDE';
export const CODE_LIEN_EXPIRE = 'LIEN_EXPIRE';

/**
 * Fabrique et vérifie les jetons des liens locataire : un JWT signé, jamais un
 * simple identifiant. Il porte l'id du document (`sub`) et la version du lien
 * (`jti`), que le garde compare à la base pour pouvoir révoquer un lien avant
 * son expiration.
 */
@Injectable()
export class EdlTokenService implements OnModuleInit {
  private readonly logger = new Logger('EdlToken');

  constructor(private readonly jwt: JwtService) {}

  onModuleInit(): void {
    if (!edlTokenSecretConfigure()) {
      this.logger.warn(
        "EDL_TOKEN_SECRET est absent : les liens d'état des lieux ne fonctionneront pas.",
      );
    }
  }

  async signer(edlId: string, jti: string, expireLe: Date): Promise<string> {
    const secondes = Math.floor((expireLe.getTime() - Date.now()) / 1000);

    return this.jwt.signAsync(
      {},
      {
        secret: edlTokenSecret(),
        subject: edlId,
        jwtid: jti,
        audience: EDL_TOKEN_AUDIENCE,
        expiresIn: Math.max(secondes, 1),
      },
    );
  }

  /**
   * Toute anomalie vaut 401 avec un message volontairement vague : distinguer
   * « signature fausse » de « document inconnu » renseignerait un attaquant.
   * Seule l'expiration est nommée, le locataire doit savoir qu'il lui faut un
   * nouveau lien.
   */
  async verifier(token: string): Promise<ContenuJetonEdl> {
    try {
      const contenu = await this.jwt.verifyAsync<{
        sub?: string;
        jti?: string;
      }>(token, { secret: edlTokenSecret(), audience: EDL_TOKEN_AUDIENCE });

      if (!contenu.sub || !contenu.jti) {
        throw new Error('jeton incomplet');
      }

      return { edlId: contenu.sub, jti: contenu.jti };
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          message: 'Ce lien a expiré. Demandez-en un nouveau au bailleur.',
          code: CODE_LIEN_EXPIRE,
        });
      }

      throw new UnauthorizedException({
        message: 'Lien invalide.',
        code: CODE_LIEN_INVALIDE,
      });
    }
  }

  construireLien(token: string): string {
    return `${edlFrontBaseUrl()}/edl/${token}`;
  }
}
