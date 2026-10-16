import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, type Prisma } from '@prisma/client';

import type { Environment } from '../../config/env.schema';

/** Cliente restringido a la transacción que fijó el contexto de negocio. */
export type ScopedClient = Prisma.TransactionClient;

const OPCIONES_TRANSACCION = { maxWait: 5_000, timeout: 15_000 } as const;

/**
 * Acceso a la base con contexto de negocio explícito (docs/05_MODELO_DATOS.md §4.3).
 *
 * Las tablas de negocio tienen Row Level Security forzado y la política niega por
 * omisión: una consulta fuera de `withTenant` o de `withoutTenantScope` no ve
 * filas. El contexto se fija con `set_config(..., true)`, así que dura lo que la
 * transacción y nunca pasa a la siguiente solicitud que reutilice la conexión.
 *
 * La conexión se abre con la primera consulta, para que el proceso arranque
 * aunque la base todavía no responda; `/v1/health/ready` lo informa.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    // La URL validada (con su valor por defecto), no la variable cruda del proceso.
    super({ datasourceUrl: config.get('DATABASE_URL', { infer: true }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Ejecuta la operación viendo solo el negocio indicado, que sale del token. */
  withTenant<T>(tenantId: string, operacion: (tx: ScopedClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return operacion(tx);
    }, OPCIONES_TRANSACCION);
  }

  /**
   * Ejecuta la operación sin restricción de negocio. Solo para las excepciones de
   * docs/05_MODELO_DATOS.md §4.4: ingreso y renovación de sesión, solicitudes de
   * vinculación de pantallas, webhooks por token de URL y jobs que recorren
   * negocios. Cualquier otro uso debilita el aislamiento.
   */
  withoutTenantScope<T>(operacion: (tx: ScopedClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.unscoped', 'on', true)`;
      return operacion(tx);
    }, OPCIONES_TRANSACCION);
  }
}
