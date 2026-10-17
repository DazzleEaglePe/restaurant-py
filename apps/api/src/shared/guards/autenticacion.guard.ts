import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { TokensAccesoService } from '../../modules/auth/tokens-acceso.service';
import { ES_PUBLICO } from '../decorators/publico.decorator';
import type { RequestConSesion } from '../decorators/sesion.decorator';
import { noAutenticado } from '../errors/api-error';

/**
 * Guarda global: toda ruta exige un access token válido salvo las marcadas con
 * `@Publico()`. Así una ruta nueva nace protegida.
 */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokensAccesoService) private readonly tokens: TokensAccesoService,
  ) {}

  canActivate(contexto: ExecutionContext): boolean {
    const publico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publico) return true;

    const request = contexto.switchToHttp().getRequest<RequestConSesion>();
    const [esquema, token] = (request.header('authorization') ?? '').split(' ');
    const sesion = esquema === 'Bearer' && token ? this.tokens.verificar(token) : null;
    if (!sesion) throw noAutenticado();

    request.sesion = sesion;
    return true;
  }
}
