import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnvironment } from './config/env.schema';
import { CorreoModule } from './infrastructure/correo/correo.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { AuthModule } from './modules/auth/auth.module';
import { CartaModule } from './modules/carta/carta.module';
import { HealthModule } from './modules/health/health.module';
import { NegociosModule } from './modules/negocios/negocios.module';
import { PlataformaModule } from './modules/plataforma/plataforma.module';
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
    CartaModule,
    HealthModule,
    NegociosModule,
    PlataformaModule,
    UsuariosModule,
  ],
})
export class AppModule {}
