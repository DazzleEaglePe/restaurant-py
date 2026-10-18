import { type INestApplication, RequestMethod } from '@nestjs/common';
import type { CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';
import cookieParser from 'cookie-parser';
import type { Express, Request } from 'express';
import helmet from 'helmet';

import { ApiExceptionFilter } from '../shared/filters/api-exception.filter';
import { requestIdMiddleware } from '../shared/middleware/request-id.middleware';

export type OpcionesAplicacion = {
  /** Origen de la web: CORS con credenciales para la API de los negocios. */
  webUrl: string;
  /** Origen de la consola interna: CORS sin credenciales y solo en `/platform/v1`. */
  plataformaUrl?: string;
  /** Proxies cuya cabecera X-Forwarded-For se acepta. */
  trustProxy?: string;
};

/** Configuración compartida por `main.ts` y las pruebas e2e. */
export function configureApplication(
  app: INestApplication,
  { webUrl, plataformaUrl, trustProxy }: OpcionesAplicacion,
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
  // CORS (docs/07 §9): la web, con credenciales, solo en la API de los negocios;
  // la consola, sin credenciales, solo en la suya. Así ninguna de las dos puede
  // leer la otra API aunque compartan sitio y les llegue la cookie.
  const cors: CorsOptionsDelegate<Request> = (solicitud, responder) => {
    if (solicitud.path.startsWith('/platform/v1/')) {
      responder(null, { origin: plataformaUrl ? [plataformaUrl] : false });
    } else {
      responder(null, { origin: [webUrl], credentials: true });
    }
  };
  app.enableCors(cors);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
}
