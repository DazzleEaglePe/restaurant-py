import { createHash } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  Carta,
  Categoria,
  CrearCategoria,
  CrearProducto,
  EditarCategoria,
  EditarProducto,
  Producto,
  ProductoEnLocal,
} from '@resto/contracts';

import { PrismaService, type ScopedClient } from '../../infrastructure/database/prisma.service';
import type { Sesion } from '../../shared/decorators/sesion.decorator';
import { ApiError } from '../../shared/errors/api-error';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { aCategoria, aProducto, DETALLE_PRODUCTO, monto } from './carta.mapper';

const noEncontrado = (que: string) =>
  new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `No encontramos ${que}.`);

const componenteInvalido = (mensaje: string) =>
  new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'COMPONENTE_INVALIDO', mensaje);

/** Los nombres de categorías y productos son únicos dentro del negocio. */
function traducirDuplicado(codigo: string, mensaje: string) {
  return (error: unknown): never => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(HttpStatus.CONFLICT, codigo, mensaje);
    }
    throw error;
  };
}

const duplicadaCategoria = traducirDuplicado(
  'CATEGORIA_DUPLICADA',
  'Ya hay una categoría con ese nombre.',
);
const duplicadoProducto = traducirDuplicado(
  'PRODUCTO_DUPLICADO',
  'Ya hay un producto con ese nombre.',
);

/**
 * Carta del negocio (docs/06_API_CONTRACT.md §6). Los productos no se borran:
 * se desactivan, para que los pedidos y reportes los sigan encontrando
 * (RF-CAR-008). Todo corre con `withTenant`, así que lo de otro negocio no existe.
 */
@Injectable()
export class CartaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditoriaService) private readonly auditoria: AuditoriaService,
  ) {}

  // --- Categorías ------------------------------------------------------------

  listarCategorias(sesion: Sesion): Promise<Categoria[]> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) =>
      (await tx.categoria.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] })).map(
        aCategoria,
      ),
    );
  }

  crearCategoria(sesion: Sesion, datos: CrearCategoria): Promise<Categoria> {
    return this.prisma
      .withTenant(sesion.tenantId, async (tx) => {
        const ultima = await tx.categoria.aggregate({ _max: { orden: true } });
        const categoria = await tx.categoria.create({
          data: {
            tenantId: sesion.tenantId,
            nombre: datos.nombre,
            orden: (ultima._max.orden ?? -1) + 1,
          },
        });
        await this.registrar(tx, sesion, 'carta.categoria_creada', 'categoria', categoria.id, {
          nombre: categoria.nombre,
        });
        return aCategoria(categoria);
      })
      .catch(duplicadaCategoria);
  }

  editarCategoria(sesion: Sesion, id: string, cambios: EditarCategoria): Promise<Categoria> {
    return this.prisma
      .withTenant(sesion.tenantId, async (tx) => {
        const { count } = await tx.categoria.updateMany({
          where: { id },
          data: { nombre: cambios.nombre, activa: cambios.activa },
        });
        if (count === 0) throw noEncontrado('esa categoría');
        await this.registrar(tx, sesion, 'carta.categoria_editada', 'categoria', id, { cambios });
        return aCategoria(await tx.categoria.findUniqueOrThrow({ where: { id } }));
      })
      .catch(duplicadaCategoria);
  }

  ordenarCategorias(sesion: Sesion, ids: string[]): Promise<Categoria[]> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      await this.ordenar(ids, (id, orden) =>
        tx.categoria.updateMany({ where: { id }, data: { orden } }),
      );
      return (await tx.categoria.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] })).map(
        aCategoria,
      );
    });
  }

  // --- Productos y combos ----------------------------------------------------

  listarProductos(sesion: Sesion): Promise<Producto[]> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) =>
      (
        await tx.producto.findMany({
          include: DETALLE_PRODUCTO,
          orderBy: [{ categoria: { orden: 'asc' } }, { orden: 'asc' }, { nombre: 'asc' }],
        })
      ).map(aProducto),
    );
  }

  crearProducto(sesion: Sesion, datos: CrearProducto): Promise<Producto> {
    return this.prisma
      .withTenant(sesion.tenantId, async (tx) => {
        await this.exigirCategoria(tx, datos.categoria_id);
        const componentes = datos.componentes ?? [];
        await this.validarComponentes(tx, null, componentes);
        const ultimo = await tx.producto.aggregate({
          where: { categoriaId: datos.categoria_id },
          _max: { orden: true },
        });
        const creado = await tx.producto.create({
          data: {
            tenantId: sesion.tenantId,
            categoriaId: datos.categoria_id,
            nombre: datos.nombre,
            descripcion: datos.descripcion ?? null,
            precio: datos.precio,
            costoTaper: datos.costo_taper ?? '0.00',
            fotoUrl: datos.foto_url ?? null,
            requiereCocina: datos.requiere_cocina ?? true,
            esCombo: componentes.length > 0,
            orden: (ultimo._max.orden ?? -1) + 1,
          },
        });
        // Aparte del create: las dos claves compuestas comparten tenant_id.
        await this.guardarComponentes(tx, sesion, creado.id, componentes);
        const producto = await tx.producto.findUniqueOrThrow({
          where: { id: creado.id },
          include: DETALLE_PRODUCTO,
        });
        await this.registrar(tx, sesion, 'carta.producto_creado', 'producto', producto.id, {
          nombre: producto.nombre,
          precio: monto(producto.precio),
        });
        return aProducto(producto);
      })
      .catch(duplicadoProducto);
  }

  editarProducto(sesion: Sesion, id: string, cambios: EditarProducto): Promise<Producto> {
    return this.prisma
      .withTenant(sesion.tenantId, async (tx) => {
        const antes = await tx.producto.findUnique({ where: { id } });
        if (!antes) throw noEncontrado('ese producto');
        if (cambios.categoria_id) await this.exigirCategoria(tx, cambios.categoria_id);
        if (cambios.componentes) {
          await this.validarComponentes(tx, id, cambios.componentes);
          await tx.comboComponente.deleteMany({ where: { comboId: id } });
          await this.guardarComponentes(tx, sesion, id, cambios.componentes);
        }
        const producto = await tx.producto.update({
          where: { id },
          data: {
            categoriaId: cambios.categoria_id,
            nombre: cambios.nombre,
            descripcion: cambios.descripcion,
            precio: cambios.precio,
            costoTaper: cambios.costo_taper,
            fotoUrl: cambios.foto_url,
            requiereCocina: cambios.requiere_cocina,
            activo: cambios.activo,
            esCombo: cambios.componentes ? cambios.componentes.length > 0 : undefined,
          },
          include: DETALLE_PRODUCTO,
        });
        await this.registrar(tx, sesion, 'carta.producto_editado', 'producto', id, { cambios });
        // RF-AUD-001: el cambio de precio queda con el antes y el después.
        if (cambios.precio !== undefined && cambios.precio !== monto(antes.precio)) {
          await this.registrar(tx, sesion, 'carta.precio_cambiado', 'producto', id, {
            nombre: producto.nombre,
            antes: monto(antes.precio),
            despues: cambios.precio,
          });
        }
        return aProducto(producto);
      })
      .catch(duplicadoProducto);
  }

  ordenarProductos(sesion: Sesion, ids: string[]): Promise<Producto[]> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      await this.ordenar(ids, (id, orden) =>
        tx.producto.updateMany({ where: { id }, data: { orden } }),
      );
      return (
        await tx.producto.findMany({
          where: { id: { in: ids } },
          include: DETALLE_PRODUCTO,
          orderBy: { orden: 'asc' },
        })
      ).map(aProducto);
    });
  }

  /** RF-CAR-006 y 009: habilitar o no en un local y su precio propio. */
  configurarEnLocal(
    sesion: Sesion,
    productoId: string,
    localId: string,
    datos: ProductoEnLocal,
  ): Promise<Producto> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      if (!(await tx.producto.findUnique({ where: { id: productoId } }))) {
        throw noEncontrado('ese producto');
      }
      if (!(await tx.local.findUnique({ where: { id: localId } }))) {
        throw noEncontrado('ese local');
      }
      await tx.productoLocal.upsert({
        where: { productoId_localId: { productoId, localId } },
        update: { habilitado: datos.habilitado, precioLocal: datos.precio_local },
        create: {
          productoId,
          localId,
          tenantId: sesion.tenantId,
          habilitado: datos.habilitado,
          precioLocal: datos.precio_local,
        },
      });
      await this.registrar(tx, sesion, 'carta.producto_en_local', 'producto', productoId, {
        ...datos,
        local_id: localId,
      });
      return aProducto(
        await tx.producto.findUniqueOrThrow({
          where: { id: productoId },
          include: DETALLE_PRODUCTO,
        }),
      );
    });
  }

  /** RF-CAR-007: la cajera marca o desmarca agotado en su local. */
  marcarAgotado(
    sesion: Sesion,
    productoId: string,
    localId: string,
    agotado: boolean,
  ): Promise<void> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      if (!(await tx.producto.findUnique({ where: { id: productoId } }))) {
        throw noEncontrado('ese producto');
      }
      await tx.productoLocal.upsert({
        where: { productoId_localId: { productoId, localId } },
        update: { agotado },
        create: { productoId, localId, tenantId: sesion.tenantId, agotado },
      });
      await this.registrar(
        tx,
        sesion,
        agotado ? 'carta.agotado' : 'carta.disponible',
        'producto',
        productoId,
        {},
        localId,
      );
    });
  }

  // --- La carta de la caja ---------------------------------------------------

  /**
   * Lo que la caja ofrece en un local: categorías activas con sus productos
   * activos y habilitados ahí, con el precio del local. La versión es un
   * resumen del contenido: cambia con cualquier cambio que se vea en la caja.
   */
  carta(sesion: Sesion, localId: string): Promise<Carta> {
    return this.prisma.withTenant(sesion.tenantId, async (tx) => {
      const categorias = await tx.categoria.findMany({
        where: { activa: true },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        include: {
          productos: {
            where: { activo: true },
            orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
            include: {
              componentes: {
                include: { producto: { select: { nombre: true } } },
                orderBy: { producto: { nombre: 'asc' } },
              },
              locales: { where: { localId } },
            },
          },
        },
      });

      const contenido = categorias
        .map((categoria) => ({
          id: categoria.id,
          nombre: categoria.nombre,
          productos: categoria.productos
            .filter((producto) => producto.locales[0]?.habilitado ?? true)
            .map((producto) => {
              const enLocal = producto.locales[0];
              return {
                id: producto.id,
                nombre: producto.nombre,
                descripcion: producto.descripcion,
                precio: monto(enLocal?.precioLocal ?? producto.precio),
                costo_taper: monto(producto.costoTaper),
                foto_url: producto.fotoUrl,
                agotado: enLocal?.agotado ?? false,
                es_combo: producto.esCombo,
                requiere_cocina: producto.requiereCocina,
                componentes: producto.componentes.map((c) => ({
                  nombre: c.producto.nombre,
                  cantidad: c.cantidad,
                })),
              };
            }),
        }))
        .filter((categoria) => categoria.productos.length > 0);

      const version = createHash('sha256')
        .update(JSON.stringify(contenido))
        .digest('hex')
        .slice(0, 16);
      return { version, categorias: contenido };
    });
  }

  // --- Apoyo -----------------------------------------------------------------

  private async guardarComponentes(
    tx: ScopedClient,
    sesion: Sesion,
    comboId: string,
    componentes: { producto_id: string; cantidad: number }[],
  ): Promise<void> {
    if (componentes.length === 0) return;
    await tx.comboComponente.createMany({
      data: componentes.map((c) => ({
        comboId,
        productoId: c.producto_id,
        cantidad: c.cantidad,
        tenantId: sesion.tenantId,
      })),
    });
  }

  private async exigirCategoria(tx: ScopedClient, id: string): Promise<void> {
    if (!(await tx.categoria.findUnique({ where: { id } }))) throw noEncontrado('esa categoría');
  }

  /**
   * Los platos de un combo son productos simples del mismo negocio: no otro
   * combo ni el mismo producto. Y un producto que ya es plato de un combo no
   * puede volverse combo, para que la cocina nunca reciba combos anidados.
   */
  private async validarComponentes(
    tx: ScopedClient,
    productoId: string | null,
    componentes: { producto_id: string }[],
  ): Promise<void> {
    if (componentes.length === 0) return;
    if (productoId && componentes.some((c) => c.producto_id === productoId)) {
      throw componenteInvalido('Un combo no puede incluirse a sí mismo.');
    }
    if (productoId && (await tx.comboComponente.count({ where: { productoId } })) > 0) {
      throw componenteInvalido('Este producto ya es plato de un combo; no puede ser combo.');
    }
    const encontrados = await tx.producto.findMany({
      where: { id: { in: componentes.map((c) => c.producto_id) } },
      select: { id: true, esCombo: true, nombre: true },
    });
    if (encontrados.length !== componentes.length) {
      throw componenteInvalido('Uno de los platos del combo no existe.');
    }
    const combo = encontrados.find((p) => p.esCombo);
    if (combo) {
      throw componenteInvalido(`«${combo.nombre}» ya es un combo; un combo lleva platos simples.`);
    }
  }

  /** Fija `orden` según la posición; si un id no es del negocio, `404` y nada cambia. */
  private async ordenar(
    ids: string[],
    actualizar: (id: string, orden: number) => Promise<{ count: number }>,
  ): Promise<void> {
    for (const [orden, id] of ids.entries()) {
      if ((await actualizar(id, orden)).count === 0) throw noEncontrado('uno de los elementos');
    }
  }

  private registrar(
    tx: ScopedClient,
    sesion: Sesion,
    accion: string,
    recursoTipo: string,
    recursoId: string,
    datos: Prisma.InputJsonObject,
    localId?: string,
  ): Promise<void> {
    return this.auditoria.registrar(tx, {
      tenantId: sesion.tenantId,
      accion,
      actorTipo: 'USUARIO',
      actorId: sesion.usuarioId,
      recursoTipo,
      recursoId,
      localId,
      datos,
    });
  }
}
