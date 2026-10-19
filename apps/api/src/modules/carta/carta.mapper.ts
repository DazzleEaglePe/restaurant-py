import type {
  Categoria as CategoriaDb,
  ComboComponente,
  Prisma,
  Producto as ProductoDb,
  ProductoLocal,
} from '@prisma/client';
import type { Categoria, Producto } from '@resto/contracts';

export const monto = (valor: Prisma.Decimal) => valor.toFixed(2);

export type ProductoConDetalle = ProductoDb & {
  componentes: (ComboComponente & { producto: Pick<ProductoDb, 'nombre'> })[];
  locales: ProductoLocal[];
};

/** Lo que se carga de un producto para responder. */
export const DETALLE_PRODUCTO = {
  componentes: {
    include: { producto: { select: { nombre: true } } },
    orderBy: { producto: { nombre: 'asc' } },
  },
  locales: true,
} as const satisfies Prisma.ProductoInclude;

export function aCategoria(categoria: CategoriaDb): Categoria {
  return {
    id: categoria.id,
    nombre: categoria.nombre,
    orden: categoria.orden,
    activa: categoria.activa,
  };
}

export function aProducto(producto: ProductoConDetalle): Producto {
  return {
    id: producto.id,
    categoria_id: producto.categoriaId,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    precio: monto(producto.precio),
    costo_taper: monto(producto.costoTaper),
    foto_url: producto.fotoUrl,
    es_combo: producto.esCombo,
    requiere_cocina: producto.requiereCocina,
    orden: producto.orden,
    activo: producto.activo,
    componentes: producto.componentes.map((c) => ({
      producto_id: c.productoId,
      nombre: c.producto.nombre,
      cantidad: c.cantidad,
    })),
    locales: producto.locales.map((l) => ({
      local_id: l.localId,
      habilitado: l.habilitado,
      agotado: l.agotado,
      precio_local: l.precioLocal ? monto(l.precioLocal) : null,
    })),
  };
}
