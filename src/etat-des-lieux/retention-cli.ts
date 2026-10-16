import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EdlRetentionService } from './edl-retention.service';

/**
 * Lance la purge des états des lieux échus, une fois, puis s'arrête :
 *
 *     npm run edl:retention                 # purge réelle
 *     npm run edl:retention -- --simulation # compte seulement, ne supprime rien
 *
 * À brancher sur une tâche planifiée de l'hébergeur : le conteneur de l'API
 * « dort » la nuit, sa tâche interne de 03 h ne s'y exécute pas toujours.
 */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const simulation = process.argv.includes('--simulation');
    const resultat = await app.get(EdlRetentionService).purger({ simulation });
    console.log(JSON.stringify(resultat, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((erreur: unknown) => {
  console.error(erreur);
  process.exit(1);
});
