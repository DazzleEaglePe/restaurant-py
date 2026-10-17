import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

import type { Environment } from '../../config/env.schema';

/**
 * Conexión con el rol `resto_plataforma`, que tiene BYPASSRLS: ve todos los
 * negocios. Solo la usa el módulo de plataforma, detrás de su lista de IPs, su
 * TOTP y su auditoría (docs/07_SEGURIDAD_AUTH.md §11). Ningún otro módulo debe
 * inyectarla.
 */
@Injectable()
export class PrismaPlataformaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    super({ datasourceUrl: config.get('DATABASE_PLATFORM_URL', { infer: true }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
