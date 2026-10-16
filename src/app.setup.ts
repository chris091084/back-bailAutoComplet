import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
// Import par étoile : cookie-parser est un module CommonJS et le tsconfig du
// projet n'active pas `esModuleInterop`, un import par défaut compilerait en
// `cookie_parser_1.default`, qui n'existe pas à l'exécution.
import * as cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { json } from 'express';
import helmet from 'helmet';

/**
 * Refuse le HTTP en clair quand `FORCE_HTTPS=true` : redirige vers la même
 * adresse en HTTPS. Le lien du locataire contient son jeton : il ne doit pas
 * circuler sans chiffrement. `request.secure` tient compte de `X-Forwarded-Proto`
 * UNIQUEMENT si `TRUST_PROXY` est posé (voir plus bas) — sans lui, derrière un
 * proxy, tout paraîtrait en clair.
 */
export function exigerHttps(
  requete: Request,
  reponse: Response,
  suite: NextFunction,
): void {
  if (process.env.FORCE_HTTPS !== 'true' || requete.secure) {
    suite();
    return;
  }

  // 308 : conserve la méthode et le corps (un POST reste un POST).
  reponse.redirect(
    308,
    `https://${requete.headers.host ?? ''}${requete.originalUrl}`,
  );
}

/**
 * Interdit toute mise en cache des réponses qui portent des données personnelles
 * (documents, saisies, signatures). La route des images pose ensuite sa propre
 * valeur `private`, qui l'emporte.
 */
export function pasDeCache(
  _requete: Request,
  reponse: Response,
  suite: NextFunction,
): void {
  reponse.setHeader('Cache-Control', 'no-store');
  suite();
}

/**
 * Middlewares et réglages HTTP de l'application. Isolés de `main.ts` pour que les
 * tests exercent exactement la configuration de production (en-têtes, limites de
 * taille), sans avoir à démarrer la base de données.
 */
export function configureApp(app: NestExpressApplication): void {
  // En-têtes de sécurité (nosniff, HSTS, pas de X-Powered-By…). L'API ne sert que
  // du JSON et des PDF : les valeurs par défaut de helmet conviennent.
  app.use(helmet());
  app.use(exigerHttps);
  app.use(['/etats-des-lieux', '/rgpd', '/onedrive'], pasDeCache);

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
  // La signature du locataire (et du bailleur) est un PNG en base64 : deux fois
  // jusqu'à ~270 ko dépassent les 100 ko ci-dessous. Route publique mais limitée
  // à 5 appels/min et à un seul document par jeton.
  app.use(/^\/etats-des-lieux\/[^/]+\/sign$/, json({ limit: '650kb' }));
  app.use(json({ limit: '100kb' }));

  // Les jetons d'authentification voyagent en cookies httpOnly : sans ce
  // middleware, `request.cookies` est vide et les stratégies JWT ne trouvent
  // rien à extraire.
  app.use(cookieParser());

  // Reprise de CorsConfig : même origine configurable, mêmes méthodes.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Indispensable pour que le navigateur accepte de poser puis de renvoyer les
    // cookies sur des requêtes cross-origin (front 4200 → API 8080).
    credentials: true,
    // Sans cet en-tête, le navigateur cache `Retry-After` au JavaScript du front,
    // qui ne saurait pas combien de temps OneDrive demande d'attendre (429).
    exposedHeaders: ['Retry-After'],
    // `allowedHeaders: '*'` est pris au pied de la lettre par les navigateurs
    // dès que `credentials` est actif : en laissant l'option vide, le middleware
    // renvoie exactement les en-têtes demandés par le préflight.
  });

  // Applique les @Exclude() posés sur les entités renvoyées telles quelles,
  // pour coller au JSON produit par Jackson.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
}
