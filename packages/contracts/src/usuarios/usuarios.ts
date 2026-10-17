import { z } from 'zod';

import { rolUsuarioSchema } from '../auth/auth.js';

/** Un miembro del negocio en `GET /v1/usuarios` (docs/06_API_CONTRACT.md §4). */
export const miembroSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  email: z.string(),
  rol: rolUsuarioSchema,
  activa: z.boolean(),
  /** Locales asignados a un CAJERO o MESERO; vacío para OWNER y ADMIN. */
  locales: z.array(z.object({ id: z.uuid(), nombre: z.string() })),
  /** Todavía no aceptó la invitación. */
  invitacion_pendiente: z.boolean(),
});

export type Miembro = z.infer<typeof miembroSchema>;

/** `PATCH /v1/usuarios/{id}`: rol, locales o desactivación. */
export const editarMiembroSchema = z
  .object({
    rol: rolUsuarioSchema,
    local_ids: z.array(z.uuid()).max(50),
    activa: z.boolean(),
  })
  .partial()
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un cambio.');

export type EditarMiembro = z.infer<typeof editarMiembroSchema>;

/** `POST /v1/auth/switch-tenant` */
export const cambiarNegocioSchema = z.object({ tenant_id: z.uuid() }).strict();

export type CambiarNegocio = z.infer<typeof cambiarNegocioSchema>;
