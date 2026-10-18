import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApplication } from './bootstrap/configure-application';
import type { Environment } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  configureApplication(app, {
    webUrl: config.get('WEB_URL', { infer: true }),
    plataformaUrl: config.get('PLATAFORMA_URL', { infer: true }),
    trustProxy: config.get('TRUST_PROXY', { infer: true }),
  });

  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap();
