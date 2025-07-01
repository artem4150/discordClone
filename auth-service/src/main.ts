import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origins = process.env.ALLOW_ORIGINS
    ? process.env.ALLOW_ORIGINS.split(',')
    : true;

  app.enableCors({ origin: origins, credentials: true });
  
  app.setGlobalPrefix('');  // Kong проксирует «/auth»
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
}
bootstrap();
