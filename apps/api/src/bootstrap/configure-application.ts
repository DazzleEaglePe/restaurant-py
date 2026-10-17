import { type INestApplication, RequestMethod } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';

import { ApiExceptionFilter } from '../shared/filters/api-exception.filter';
import { requestIdMiddleware } from '../shared/middleware/request-id.middleware';

/** Configuración compartida por `main.ts` y las pruebas e2e. */
export function configureApplication(
  app: INestApplication,
  webUrl: string,
  trustProxy?: string,
): void {
  // La IP real llega en X-Forwarded-For solo a través de los proxies indicados;
  // sin TRUST_PROXY no se confía en nadie. La lista de IPs de plataforma la usa.
  const express: Express = app.getHttpAdapter().getInstance();
  express.set('trust proxy', trustProxy ?? false);

  // docs/06_API_CONTRACT.md §1.1: la API propia vive bajo `/v1`; la consola de
  // plataforma declara su ruta completa (`/platform/v1`).
  app.setGlobalPrefix('v1', {
    exclude: [{ path: 'platform/v1/{*ruta}', method: RequestMethod.ALL }],
  });
  // Primero, para que hasta un 404 lleve su X-Request-Id (§1.2).
  app.use(requestIdMiddleware);
  app.use(helmet());
  // El refresh token llega en cookie (docs/07_SEGURIDAD_AUTH.md §2.2).
  app.use(cookieParser());
  // CORS con credenciales solo desde el origen de la web (docs/07 §9).
  app.enableCors({ credentials: true, origin: [webUrl] });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
}
