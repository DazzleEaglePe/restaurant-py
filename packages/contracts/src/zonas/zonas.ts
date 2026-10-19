import { z } from 'zod';

// Zonas de cada local (docs/06_API_CONTRACT.md §7). Sin mesas numeradas (D12).

export const zonaSchema = z.object({
  id: z.uuid(),
  local_id: z.uuid(),
  nombre: z.string(),
  /** «1er piso», «2do piso». */
  piso: z.string().nullable(),
  orden: z.number().int(),
  activa: z.boolean(),
});

export type Zona = z.infer<typeof zonaSchema>;

/** `POST /v1/locales/{id}/zonas` */
export const crearZonaSchema = z
  .object({
    nombre: z.string().trim().min(2).max(40),
    piso: z.string().trim().max(20).nullable().optional(),
  })
  .strict();

export type CrearZona = z.infer<typeof crearZonaSchema>;

/** `PATCH /v1/zonas/{id}`. El orden va en `PUT /v1/locales/{id}/zonas/orden`. */
export const editarZonaSchema = z
  .object({
    nombre: z.string().trim().min(2).max(40),
    piso: z.string().trim().max(20).nullable(),
    activa: z.boolean(),
  })
  .partial()
  .strict();

export type EditarZona = z.infer<typeof editarZonaSchema>;
