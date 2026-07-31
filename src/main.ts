import { ClassSerializerInterceptor } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Reprise de CorsConfig : même origine configurable, mêmes méthodes.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
  });

  // Applique les @Exclude() posés sur les entités renvoyées telles quelles,
  // pour coller au JSON produit par Jackson.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
}

void bootstrap();
