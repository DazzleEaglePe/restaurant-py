import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

/** Configuración compartida por `main.ts` y las pruebas e2e. */
export function configureApplication(app: INestApplication, webUrl: string): void {
  // docs/06_API_CONTRACT.md §1: la API propia vive bajo `/v1`.
  app.setGlobalPrefix('v1');
  app.use(helmet());
  // El refresh token viaja en cookie, así que CORS admite credenciales solo
  // desde el origen de la web (docs/07_SEGURIDAD_AUTH.md §9).
  app.enableCors({ credentials: true, origin: [webUrl] });
  app.enableShutdownHooks();
}
