import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthResponse, ReadinessResponse } from '@resto/contracts';
import type { Response } from 'express';

import type { Environment } from '../../config/env.schema';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Publico } from '../../shared/decorators/publico.decorator';

@Publico()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** Liveness: el proceso responde. No toca la base a propósito, para que una
   * caída de PostgreSQL no reinicie el contenedor en cadena. */
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'resto-api',
      release: this.config.get('APP_RELEASE', { infer: true }),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: la API puede atender porque llega a PostgreSQL. */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async getReadiness(@Res({ passthrough: true }) res: Response): Promise<ReadinessResponse> {
    const database = await this.prisma.$queryRaw`SELECT 1`.then(
      () => 'up' as const,
      () => 'down' as const,
    );
    if (database === 'down') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: database === 'up' ? 'ok' : 'error', checks: { database } };
  }
}
