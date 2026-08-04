import { ClassSerializerInterceptor } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
// Import par étoile : cookie-parser est un module CommonJS et le tsconfig du
// projet n'active pas `esModuleInterop`, un import par défaut compilerait en
// `cookie_parser_1.default`, qui n'existe pas à l'exécution.
import * as cookieParser from 'cookie-parser';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // POST /mail/send transporte les pièces jointes en base64 dans le JSON : la
  // limite Express par défaut (100 ko) refuserait un .docx de taille normale.
  app.use(json({ limit: '10mb' }));

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

  await app.listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
}

void bootstrap();
