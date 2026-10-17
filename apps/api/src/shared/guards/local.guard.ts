import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { operaEnTodosLosLocales } from '../decorators/roles.decorator';
import type { RequestConSesion } from '../decorators/sesion.decorator';
import { ApiError } from '../errors/api-error';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RequestConLocal = RequestConSesion & { localId?: string };

/**
 * Rutas de operación: exigen `X-Local-Id` y que el usuario opere en ese local
 * (docs/07_SEGURIDAD_AUTH.md §4.2, invariante 2).
 */
@Injectable()
export class LocalGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const request = contexto.switchToHttp().getRequest<RequestConLocal>();
    const sesion = request.sesion;
    if (!sesion) return false;

    const localId = request.header('x-local-id') ?? '';
    if (!UUID.test(localId)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Indica el local en la cabecera X-Local-Id.',
      );
    }

    // Los locales de un CAJERO o MESERO vienen en el token; un cambio de
    // asignación revoca sus sesiones y el próximo token ya lo refleja.
    if (!operaEnTodosLosLocales(sesion.rol) && !sesion.locales.includes(localId)) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'LOCAL_NO_ASIGNADO',
        'No estás asignado a este local.',
      );
    }

    // RLS limita la búsqueda al negocio del token: un local ajeno no aparece.
    const existe = await this.prisma.withTenant(sesion.tenantId, (tx) =>
      tx.local.count({ where: { id: localId, activo: true } }),
    );
    if (!existe) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        'El local no existe o está desactivado.',
      );
    }

    request.localId = localId;
    return true;
  }
}
