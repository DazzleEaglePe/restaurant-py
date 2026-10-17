import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RolUsuario } from '@resto/contracts';

import { ES_PUBLICO } from '../decorators/publico.decorator';
import { ROLES_PERMITIDOS } from '../decorators/roles.decorator';
import type { RequestConSesion } from '../decorators/sesion.decorator';
import { ApiError } from '../errors/api-error';

/** Guarda global que corre después de la autenticación y aplica `@Roles()`. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const destinos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, destinos)) return true;

    const roles = this.reflector.getAllAndOverride<readonly RolUsuario[]>(
      ROLES_PERMITIDOS,
      destinos,
    );
    if (!roles) return true;

    const sesion = contexto.switchToHttp().getRequest<RequestConSesion>().sesion;
    if (sesion && roles.includes(sesion.rol)) return true;
    throw new ApiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Tu rol no permite esta acción.');
  }
}
