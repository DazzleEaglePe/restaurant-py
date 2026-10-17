import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnvironment } from './config/env.schema';
import { CorreoModule } from './infrastructure/correo/correo.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { NegociosModule } from './modules/negocios/negocios.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      expandVariables: false,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    CorreoModule,
    AuditoriaModule,
    AuthModule,
    HealthModule,
    NegociosModule,
    UsuariosModule,
  ],
})
export class AppModule {}
