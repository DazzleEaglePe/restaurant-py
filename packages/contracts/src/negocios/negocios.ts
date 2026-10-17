import { z } from 'zod';

import { montoSchema } from '../comun/monto.js';

/** `GET /v1/negocio` (docs/06_API_CONTRACT.md §3). */
export const negocioSchema = z.object({
  id: z.uuid(),
  nombre_comercial: z.string(),
  razon_social: z.string().nullable(),
  ruc: z.string().nullable(),
  zona_horaria: z.string(),
  logo_url: z.string().nullable(),
  color_acento: z.string().nullable(),
  estado: z.enum(['ACTIVO', 'SUSPENDIDO']),
});

export type Negocio = z.infer<typeof negocioSchema>;

/** `PATCH /v1/negocio`, solo OWNER. */
export const editarNegocioSchema = z
  .object({
    nombre_comercial: z.string().trim().min(2).max(120),
    razon_social: z.string().trim().max(160).nullable(),
    ruc: z
      .string()
      .regex(/^\d{11}$/, 'El RUC tiene 11 dígitos.')
      .nullable(),
    logo_url: z.url().nullable(),
    color_acento: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'El color va como #RRGGBB.')
      .nullable(),
  })
  .partial()
  .strict();

export type EditarNegocio = z.infer<typeof editarNegocioSchema>;

const estadoCobrosSchema = z.enum([
  'ACTIVO',
  'DEMORADO',
  'DESCONECTADO',
  'SIN_SERVICIO',
  'CONEXION_INVALIDA',
  'SIN_CELULAR',
]);

/** Un local con su configuración operativa (RF-TEN-003). */
export const localSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  direccion: z.string().nullable(),
  activo: z.boolean(),
  ventana_pagos_min: z.number().int(),
  permite_constancia: z.boolean(),
  monto_max_constancia: montoSchema.nullable(),
  mesa_obligatoria: z.boolean(),
  cocina_alerta_min: z.number().int(),
  cocina_critico_min: z.number().int(),
  ocultar_listos_min: z.number().int(),
  tiempo_base_min: z.number().int(),
  costo_taper_defecto: montoSchema,
  estado_cobros: estadoCobrosSchema,
  estado_cobros_desde: z.iso.datetime(),
});

export type Local = z.infer<typeof localSchema>;

const minutos = (minimo: number, maximo: number) => z.number().int().min(minimo).max(maximo);

const configuracionLocalSchema = z.object({
  direccion: z.string().trim().max(200).nullable(),
  ventana_pagos_min: minutos(5, 60),
  permite_constancia: z.boolean(),
  monto_max_constancia: montoSchema.nullable(),
  mesa_obligatoria: z.boolean(),
  cocina_alerta_min: minutos(1, 120),
  cocina_critico_min: minutos(1, 240),
  ocultar_listos_min: minutos(1, 120),
  tiempo_base_min: minutos(1, 180),
  costo_taper_defecto: montoSchema,
});

/** `POST /v1/locales` */
export const crearLocalSchema = configuracionLocalSchema
  .partial()
  .extend({ nombre: z.string().trim().min(2).max(80) })
  .strict();

export type CrearLocal = z.infer<typeof crearLocalSchema>;

/** `PATCH /v1/locales/{id}`: datos, configuración y activación. */
export const editarLocalSchema = configuracionLocalSchema
  .extend({ nombre: z.string().trim().min(2).max(80), activo: z.boolean() })
  .partial()
  .strict();

export type EditarLocal = z.infer<typeof editarLocalSchema>;
