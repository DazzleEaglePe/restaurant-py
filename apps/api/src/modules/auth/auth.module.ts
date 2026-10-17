import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { AutenticacionGuard } from '../../shared/guards/autenticacion.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensAccesoService } from './tokens-acceso.service';

@Module({
  imports: [
    // Contadores en memoria; pasan a Redis cuando la API tenga más de una instancia.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensAccesoService,
    // Toda ruta exige sesión salvo las marcadas con @Publico(); después se
    // aplican los roles de @Roles(). El orden de registro es el de ejecución.
    { provide: APP_GUARD, useClass: AutenticacionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [TokensAccesoService],
})
export class AuthModule {}
