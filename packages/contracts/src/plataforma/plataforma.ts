import { z } from 'zod';

/** `POST /platform/v1/auth/login` (docs/06_API_CONTRACT.md §19): contraseña y TOTP. */
export const loginPlataformaSchema = z
  .object({
    email: z.email().max(254),
    password: z.string().min(1).max(256),
    totp: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos.'),
  })
  .strict();

export type LoginPlataforma = z.infer<typeof loginPlataformaSchema>;

export const sesionPlataformaSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().int().positive(),
  admin: z.object({ id: z.uuid(), nombre: z.string(), email: z.string() }),
});

export type SesionPlataforma = z.infer<typeof sesionPlataformaSchema>;

/** Un negocio en la lista de la consola. */
export const negocioPlataformaSchema = z.object({
  id: z.uuid(),
  nombre_comercial: z.string(),
  estado: z.enum(['ACTIVO', 'SUSPENDIDO']),
  locales: z.number().int(),
  duenos: z.array(z.object({ email: z.string(), invitacion_pendiente: z.boolean() })),
  created_at: z.iso.datetime(),
});

export type NegocioPlataforma = z.infer<typeof negocioPlataformaSchema>;

/** `POST /platform/v1/negocios`: alta asistida con su primer local y su OWNER (RF-PLT-001). */
export const crearNegocioPlataformaSchema = z
  .object({
    nombre_comercial: z.string().trim().min(2).max(120),
    local_inicial: z.string().trim().min(2).max(80),
    owner: z.object({
      email: z.email().max(254),
      nombre: z.string().trim().min(2).max(80),
    }),
  })
  .strict();

export type CrearNegocioPlataforma = z.infer<typeof crearNegocioPlataformaSchema>;
