import { z } from 'zod';

import { rolUsuarioSchema } from '../auth/auth.js';

/** `POST /v1/usuarios/invitaciones` (docs/06_API_CONTRACT.md §4). */
export const invitarMiembroSchema = z
  .object({
    email: z.email().max(254),
    nombre: z.string().trim().min(2).max(80),
    rol: rolUsuarioSchema,
    local_ids: z.array(z.uuid()).max(50).default([]),
  })
  .strict();

export type InvitarMiembro = z.infer<typeof invitarMiembroSchema>;

/** Contraseña nueva: el largo se valida aquí; la lista de comunes, en la API. */
const nuevaContrasenaSchema = z.string().min(10).max(128);

/** `POST /v1/auth/invitations/accept`: activa la cuenta y abre la sesión. */
export const aceptarInvitacionSchema = z
  .object({ token: z.string().min(20).max(100), password: nuevaContrasenaSchema })
  .strict();

export type AceptarInvitacion = z.infer<typeof aceptarInvitacionSchema>;

/** `POST /v1/auth/password/forgot` */
export const olvideContrasenaSchema = z.object({ email: z.email().max(254) }).strict();

export type OlvideContrasena = z.infer<typeof olvideContrasenaSchema>;

/** `POST /v1/auth/password/reset` */
export const restablecerContrasenaSchema = z
  .object({ token: z.string().min(20).max(100), password: nuevaContrasenaSchema })
  .strict();

export type RestablecerContrasena = z.infer<typeof restablecerContrasenaSchema>;
