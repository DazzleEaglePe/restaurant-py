import { randomBytes } from 'node:crypto';

import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../config/env.schema';
import { Cifrador } from '../../infrastructure/crypto/cifrado';
import { PrismaPlataformaService } from '../../infrastructure/database/prisma-plataforma.service';
import { AuthModule } from '../auth/auth.module';
import { PlataformaAuthController, PlataformaNegociosController } from './plataforma.controller';
import { PlataformaIpGuard, PlataformaSesionGuard } from './plataforma.guards';
import { PlataformaService } from './plataforma.service';

@Module({
  imports: [AuthModule],
  controllers: [PlataformaAuthController, PlataformaNegociosController],
  providers: [
    PlataformaService,
    PrismaPlataformaService,
    PlataformaIpGuard,
    PlataformaSesionGuard,
    {
      provide: Cifrador,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => {
        const clave = config.get('ENCRYPTION_KEY', { infer: true });
        if (clave) return new Cifrador(clave);
        // El esquema de entorno la exige en producción.
        new Logger('Cifrador').warn('Sin ENCRYPTION_KEY: se usa una clave temporal.');
        return new Cifrador(randomBytes(32).toString('base64'));
      },
    },
  ],
  exports: [Cifrador],
})
export class PlataformaModule {}
