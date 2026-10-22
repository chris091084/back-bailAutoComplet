import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { verifierConfigurationChiffrement } from './common/encryption';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  // Refuse de démarrer sans clé valide plutôt que d'écrire des données en clair
  // ou de planter à la première requête. L'empreinte (jamais la clé) permet de
  // vérifier qu'un script lancé depuis un poste utilise la même clé.
  const empreinte = verifierConfigurationChiffrement();
  new Logger('Chiffrement').log(
    `Colonnes personnelles chiffrées (empreinte de la clé : ${empreinte})`,
  );

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  configureApp(app);

  await app.listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
}

void bootstrap();
