import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RolUsuario } from '@resto/contracts';
import type { Request } from 'express';

/** Sesión del access token verificado. `tenantId` sale de aquí, nunca de la solicitud. */
export type Sesion = {
  usuarioId: string;
  tenantId: string;
  rol: RolUsuario;
  /** Locales asignados; vacío para OWNER y ADMIN, que operan en todos. */
  locales: string[];
};

export type RequestConSesion = Request & { sesion?: Sesion };

export const SesionActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): Sesion => {
    const sesion = contexto.switchToHttp().getRequest<RequestConSesion>().sesion;
    if (!sesion) throw new Error('SesionActual en una ruta sin autenticación.');
    return sesion;
  },
);
