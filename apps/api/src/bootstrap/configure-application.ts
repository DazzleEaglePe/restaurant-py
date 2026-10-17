import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { ApiExceptionFilter } from '../shared/filters/api-exception.filter';
import { requestIdMiddleware } from '../shared/middleware/request-id.middleware';

/** Configuración compartida por `main.ts` y las pruebas e2e. */
export function configureApplication(app: INestApplication, webUrl: string): void {
  // docs/06_API_CONTRACT.md §1: la API propia vive bajo `/v1`.
  app.setGlobalPrefix('v1');
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
