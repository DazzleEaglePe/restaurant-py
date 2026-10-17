import { z } from 'zod';

/** Roles del negocio (docs/07_SEGURIDAD_AUTH.md §4.1). */
export const rolUsuarioSchema = z.enum(['OWNER', 'ADMIN', 'CAJERO', 'MESERO']);
export type RolUsuario = z.infer<typeof rolUsuarioSchema>;

/** `POST /v1/auth/login` (docs/06_API_CONTRACT.md §2). */
export const loginRequestSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Usuario, negocio activo, rol y locales: `GET /v1/me`. */
export const meResponseSchema = z.object({
  user: z.object({ id: z.uuid(), nombre: z.string(), email: z.string() }),
  tenant: z.object({ id: z.uuid(), nombre_comercial: z.string() }),
  rol: rolUsuarioSchema,
  // OWNER y ADMIN reciben todos los locales activos; CAJERO y MESERO, los asignados.
  locales: z.array(z.object({ id: z.uuid(), nombre: z.string() })),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

/** Respuesta de `login` y `refresh`: la sesión más el access token. El refresh
 * token viaja aparte, en una cookie `HttpOnly`. */
export const sesionResponseSchema = meResponseSchema.extend({
  access_token: z.string(),
  expires_in: z.number().int().positive(),
});

export type SesionResponse = z.infer<typeof sesionResponseSchema>;

/** Contenido del access token (docs/07_SEGURIDAD_AUTH.md §2.1). `loc` vacío
 * significa «todos los locales» (OWNER y ADMIN). */
export const accessTokenClaimsSchema = z.object({
  sub: z.uuid(),
  tid: z.uuid(),
  rol: rolUsuarioSchema,
  loc: z.array(z.uuid()),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;
