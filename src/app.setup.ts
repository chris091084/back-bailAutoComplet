import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
// Import par étoile : cookie-parser est un module CommonJS et le tsconfig du
// projet n'active pas `esModuleInterop`, un import par défaut compilerait en
// `cookie_parser_1.default`, qui n'existe pas à l'exécution.
import * as cookieParser from 'cookie-parser';
import { json } from 'express';
import helmet from 'helmet';

/**
 * Middlewares et réglages HTTP de l'application. Isolés de `main.ts` pour que les
 * tests exercent exactement la configuration de production (en-têtes, limites de
 * taille), sans avoir à démarrer la base de données.
 */
export function configureApp(app: NestExpressApplication): void {
  // En-têtes de sécurité (nosniff, HSTS, pas de X-Powered-By…). L'API ne sert que
  // du JSON et des PDF : les valeurs par défaut de helmet conviennent.
  app.use(helmet());

  // Derrière le proxy de l'hébergeur, `request.ip` vaudrait l'adresse du proxy :
  // tous les visiteurs partageraient alors le même quota de limitation de débit.
  // `TRUST_PROXY` = nombre de proxys de confiance devant l'API (1 en général).
  // Laissé vide par défaut : un réglage trop large permettrait de falsifier son IP
  // via `X-Forwarded-For` et d'échapper à la limitation.
  const trustedProxies = Number(process.env.TRUST_PROXY);
  if (Number.isInteger(trustedProxies) && trustedProxies > 0) {
    app.set('trust proxy', trustedProxies);
  }

  // Corps JSON plafonnés à 100 ko : ils sont lus AVANT l'authentification, donc
  // n'importe qui peut en envoyer, et chaque octet reçu est du CPU/mémoire facturé.
  // Seul POST /mail/send transporte des pièces jointes en base64 (un .docx de taille
  // normale dépasse la limite Express par défaut) : il garde 10 Mo. Ce parseur doit
  // être déclaré en premier, le suivant ignore une requête déjà lue.
  app.use('/mail/send', json({ limit: '10mb' }));
  app.use(json({ limit: '100kb' }));

  // Les jetons d'authentification voyagent en cookies httpOnly : sans ce
  // middleware, `request.cookies` est vide et les stratégies JWT ne trouvent
  // rien à extraire.
  app.use(cookieParser());

  // Reprise de CorsConfig : même origine configurable, mêmes méthodes.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    // Indispensable pour que le navigateur accepte de poser puis de renvoyer les
    // cookies sur des requêtes cross-origin (front 4200 → API 8080).
    credentials: true,
    // `allowedHeaders: '*'` est pris au pied de la lettre par les navigateurs
    // dès que `credentials` est actif : en laissant l'option vide, le middleware
    // renvoie exactement les en-têtes demandés par le préflight.
  });

  // Applique les @Exclude() posés sur les entités renvoyées telles quelles,
  // pour coller au JSON produit par Jackson.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
}
