import { z } from 'zod';

import { montoSchema } from '../comun/monto.js';

// Carta del negocio (docs/06_API_CONTRACT.md §6, docs/05_MODELO_DATOS.md §3.4).

/** `GET /v1/categorias` */
export const categoriaSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  orden: z.number().int(),
  activa: z.boolean(),
});

export type Categoria = z.infer<typeof categoriaSchema>;

/** `POST /v1/categorias` */
export const crearCategoriaSchema = z.object({ nombre: z.string().trim().min(2).max(60) }).strict();

export type CrearCategoria = z.infer<typeof crearCategoriaSchema>;

/** `PATCH /v1/categorias/{id}`: renombrar o desactivar. El orden va en `PUT /v1/categorias/orden`. */
export const editarCategoriaSchema = z
  .object({ nombre: z.string().trim().min(2).max(60), activa: z.boolean() })
  .partial()
  .strict();

export type EditarCategoria = z.infer<typeof editarCategoriaSchema>;

/** Orden por arrastre: los ids en el orden nuevo (`PUT /v1/categorias/orden`, `PUT /v1/productos/orden`). */
export const ordenarSchema = z
  .object({ ids: z.array(z.uuid()).min(1).max(500) })
  .strict()
  .refine((datos) => new Set(datos.ids).size === datos.ids.length, {
    message: 'Hay ids repetidos.',
    path: ['ids'],
  });

export type Ordenar = z.infer<typeof ordenarSchema>;

const componenteEntradaSchema = z
  .object({ producto_id: z.uuid(), cantidad: z.number().int().min(1).max(20) })
  .strict();

const datosProductoSchema = z.object({
  categoria_id: z.uuid(),
  nombre: z.string().trim().min(2).max(80),
  descripcion: z.string().trim().max(300).nullable(),
  precio: montoSchema,
  costo_taper: montoSchema,
  foto_url: z.url().nullable(),
  requiere_cocina: z.boolean(),
  /** Con platos es un combo de precio propio (RF-CAR-003); sin platos, un producto simple. */
  componentes: z
    .array(componenteEntradaSchema)
    .max(10)
    .refine((lista) => new Set(lista.map((c) => c.producto_id)).size === lista.length, {
      message: 'Un plato aparece dos veces; usa la cantidad.',
    }),
});

/** `POST /v1/productos` */
export const crearProductoSchema = datosProductoSchema
  .partial({
    descripcion: true,
    costo_taper: true,
    foto_url: true,
    requiere_cocina: true,
    componentes: true,
  })
  .strict();

export type CrearProducto = z.infer<typeof crearProductoSchema>;

/** `PATCH /v1/productos/{id}`. Si llegan `componentes`, reemplazan a los anteriores. */
export const editarProductoSchema = datosProductoSchema
  .extend({ activo: z.boolean() })
  .partial()
  .strict();

export type EditarProducto = z.infer<typeof editarProductoSchema>;

/** `PUT /v1/productos/{id}/locales/{local_id}` (RF-CAR-006 y 009). */
export const productoEnLocalSchema = z
  .object({ habilitado: z.boolean(), precio_local: montoSchema.nullable() })
  .strict();

export type ProductoEnLocal = z.infer<typeof productoEnLocalSchema>;

/** Un producto o combo en la administración. */
export const productoSchema = z.object({
  id: z.uuid(),
  categoria_id: z.uuid(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  precio: montoSchema,
  costo_taper: montoSchema,
  foto_url: z.string().nullable(),
  es_combo: z.boolean(),
  requiere_cocina: z.boolean(),
  orden: z.number().int(),
  activo: z.boolean(),
  componentes: z.array(
    z.object({ producto_id: z.uuid(), nombre: z.string(), cantidad: z.number().int() }),
  ),
  /** Solo los locales con algo distinto de lo general; sin fila, habilitado y sin agotar. */
  locales: z.array(
    z.object({
      local_id: z.uuid(),
      habilitado: z.boolean(),
      agotado: z.boolean(),
      precio_local: montoSchema.nullable(),
    }),
  ),
});

export type Producto = z.infer<typeof productoSchema>;

/** `GET /v1/carta` con `X-Local-Id`: lo que la caja ofrece en ese local. */
export const cartaSchema = z.object({
  /** Cambia con cualquier cambio de la carta del local; también va en `ETag`. */
  version: z.string(),
  categorias: z.array(
    z.object({
      id: z.uuid(),
      nombre: z.string(),
      productos: z.array(
        z.object({
          id: z.uuid(),
          nombre: z.string(),
          descripcion: z.string().nullable(),
          /** Precio del local si tiene uno; si no, el general. */
          precio: montoSchema,
          costo_taper: montoSchema,
          foto_url: z.string().nullable(),
          agotado: z.boolean(),
          es_combo: z.boolean(),
          requiere_cocina: z.boolean(),
          componentes: z.array(z.object({ nombre: z.string(), cantidad: z.number().int() })),
        }),
      ),
    }),
  ),
});

export type Carta = z.infer<typeof cartaSchema>;
