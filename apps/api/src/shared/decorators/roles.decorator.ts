import { SetMetadata } from '@nestjs/common';
import type { RolUsuario } from '@resto/contracts';

export const ROLES_PERMITIDOS = 'resto:roles';

/** Roles que pueden usar la ruta (docs/02_REQUERIMIENTOS_FUNCIONALES.md §3.1).
 * Sin este decorador, basta con tener sesión. */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_PERMITIDOS, roles);

/** Grupos de la matriz de roles. */
export const ROLES = {
  /** Locales, equipo, carta, reportes y cierre del día. */
  administracion: ['OWNER', 'ADMIN'],
  /** Turno, pedidos y cobros. */
  caja: ['OWNER', 'ADMIN', 'CAJERO'],
  /** Todo el personal del negocio. */
  personal: ['OWNER', 'ADMIN', 'CAJERO', 'MESERO'],
} as const satisfies Record<string, readonly RolUsuario[]>;

/** OWNER y ADMIN operan en todos los locales; el resto, en los asignados. */
export const operaEnTodosLosLocales = (rol: RolUsuario) => rol === 'OWNER' || rol === 'ADMIN';
