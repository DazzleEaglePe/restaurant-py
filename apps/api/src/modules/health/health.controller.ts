import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthResponse } from '@resto/contracts';

import type { Environment } from '../../config/env.schema';

@Controller('health')
export class HealthController {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<Environment, true>) {}

  /** Liveness: el proceso responde. La disponibilidad de la base y Redis va en
   * `/health/ready`, que llega con el esquema inicial. */
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'resto-api',
      release: this.config.get('APP_RELEASE', { infer: true }),
      timestamp: new Date().toISOString(),
    };
  }
}
