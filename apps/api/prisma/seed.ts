/**
 * «Cevichería Demo» para desarrollo y staging (docs/05_MODELO_DATOS.md §5.1).
 *
 * Crea lo que existe en el esquema actual: el negocio, sus locales, los usuarios
 * de demostración y sus membresías. La carta, las zonas y la conexión con
 * Yallegó se agregan en los sprints que crean esas tablas. Se puede correr
 * varias veces: actualiza en vez de duplicar.
 */
import { PrismaClient, type RolUsuario } from '@prisma/client';

import {
  LONGITUD_MINIMA_CONTRASENA,
  hashearContrasena,
} from '../src/infrastructure/crypto/contrasenas';

const NEGOCIO_DEMO_ID = '00000000-0000-4000-8000-000000000001';

const USUARIOS: ReadonlyArray<{
  email: string;
  nombre: string;
  rol: RolUsuario;
  locales: ReadonlyArray<'Centro' | 'Norte'>;
}> = [
  { email: 'dueno@demo.test', nombre: 'Dueña Demo', rol: 'OWNER', locales: [] },
  { email: 'admin@demo.test', nombre: 'Admin Demo', rol: 'ADMIN', locales: [] },
  { email: 'caja1@demo.test', nombre: 'Cajera Centro', rol: 'CAJERO', locales: ['Centro'] },
  { email: 'caja2@demo.test', nombre: 'Cajera Norte', rol: 'CAJERO', locales: ['Norte'] },
  { email: 'mesera1@demo.test', nombre: 'Mesera Centro', rol: 'MESERO', locales: ['Centro'] },
];

/** Carta de docs/05_MODELO_DATOS.md §5.1: S/ 1.00 de táper por plato; bebidas sin táper. */
const CATEGORIAS = ['Ceviches', 'Combinados', 'Platos de fondo', 'Bebidas', 'Adicionales'] as const;

const PRODUCTOS: ReadonlyArray<{
  nombre: string;
  categoria: (typeof CATEGORIAS)[number];
  precio: string;
  cocina: boolean;
  taper: string;
}> = [
  {
    nombre: 'Ceviche de pescado',
    categoria: 'Ceviches',
    precio: '25.00',
    cocina: true,
    taper: '1.00',
  },
  {
    nombre: 'Chicharrón de pescado',
    categoria: 'Platos de fondo',
    precio: '28.00',
    cocina: true,
    taper: '1.00',
  },
  {
    nombre: 'Chicharrón de pota',
    categoria: 'Platos de fondo',
    precio: '22.00',
    cocina: true,
    taper: '1.00',
  },
  {
    nombre: 'Jalea mixta',
    categoria: 'Platos de fondo',
    precio: '38.00',
    cocina: true,
    taper: '1.00',
  },
  {
    nombre: 'Arroz con mariscos',
    categoria: 'Platos de fondo',
    precio: '30.00',
    cocina: true,
    taper: '1.00',
  },
  {
    nombre: 'Coca-Cola personal',
    categoria: 'Bebidas',
    precio: '4.00',
    cocina: false,
    taper: '0.00',
  },
  {
    nombre: 'Inca Kola personal',
    categoria: 'Bebidas',
    precio: '4.00',
    cocina: false,
    taper: '0.00',
  },
  {
    nombre: 'Chicha morada 1 L',
    categoria: 'Bebidas',
    precio: '10.00',
    cocina: false,
    taper: '0.00',
  },
  {
    nombre: 'Canchita adicional',
    categoria: 'Adicionales',
    precio: '3.00',
    cocina: true,
    taper: '0.00',
  },
];

const COMBOS: ReadonlyArray<{ nombre: string; precio: string; platos: readonly string[] }> = [
  { nombre: 'Mixto', precio: '32.00', platos: ['Ceviche de pescado', 'Chicharrón de pota'] },
  {
    nombre: 'Trío marino',
    precio: '42.00',
    platos: ['Ceviche de pescado', 'Chicharrón de pescado', 'Arroz con mariscos'],
  },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('La semilla de demostración no se corre en producción.');
  }
  const contrasena = process.env.SEED_PASSWORD ?? '';
  if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
    throw new Error(
      `Define SEED_PASSWORD en .env con al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`,
    );
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashearContrasena(contrasena);

    await prisma.$transaction(async (tx) => {
      // La semilla recorre un negocio sin sesión: excepción de §4.4.
      await tx.$queryRaw`SELECT set_config('app.unscoped', 'on', true)`;

      const negocio = await tx.negocio.upsert({
        where: { id: NEGOCIO_DEMO_ID },
        update: {},
        create: { id: NEGOCIO_DEMO_ID, nombreComercial: 'Cevichería Demo', colorAcento: '#FF6B57' },
      });

      const locales = new Map<string, string>();
      for (const nombre of ['Centro', 'Norte']) {
        const local = await tx.local.upsert({
          where: { tenantId_nombre: { tenantId: negocio.id, nombre } },
          update: {},
          create: { tenantId: negocio.id, nombre },
        });
        locales.set(nombre, local.id);
      }

      const categorias = new Map<string, string>();
      for (const [orden, nombre] of CATEGORIAS.entries()) {
        const categoria = await tx.categoria.upsert({
          where: { tenantId_nombre: { tenantId: negocio.id, nombre } },
          update: { orden, activa: true },
          create: { tenantId: negocio.id, nombre, orden },
        });
        categorias.set(nombre, categoria.id);
      }

      const productos = new Map<string, string>();
      const crearProducto = async (
        nombre: string,
        categoria: string,
        datos: { precio: string; requiereCocina: boolean; costoTaper: string; esCombo: boolean },
        orden: number,
      ) => {
        const producto = await tx.producto.upsert({
          where: { tenantId_nombre: { tenantId: negocio.id, nombre } },
          update: { ...datos, categoriaId: categorias.get(categoria)!, orden, activo: true },
          create: {
            ...datos,
            tenantId: negocio.id,
            categoriaId: categorias.get(categoria)!,
            nombre,
            orden,
          },
        });
        productos.set(nombre, producto.id);
        return producto.id;
      };
      for (const [orden, p] of PRODUCTOS.entries()) {
        await crearProducto(
          p.nombre,
          p.categoria,
          { precio: p.precio, requiereCocina: p.cocina, costoTaper: p.taper, esCombo: false },
          orden,
        );
      }
      for (const [orden, combo] of COMBOS.entries()) {
        const comboId = await crearProducto(
          combo.nombre,
          'Combinados',
          { precio: combo.precio, requiereCocina: true, costoTaper: '1.00', esCombo: true },
          orden,
        );
        await tx.comboComponente.deleteMany({ where: { comboId } });
        await tx.comboComponente.createMany({
          data: combo.platos.map((plato) => ({
            comboId,
            productoId: productos.get(plato)!,
            tenantId: negocio.id,
          })),
        });
      }

      for (const datos of USUARIOS) {
        const usuario = await tx.usuario.upsert({
          where: { email: datos.email },
          update: { nombre: datos.nombre, passwordHash, intentosFallidos: 0, bloqueadoHasta: null },
          create: { email: datos.email, nombre: datos.nombre, passwordHash },
        });
        const membresia = await tx.membresia.upsert({
          where: { tenantId_usuarioId: { tenantId: negocio.id, usuarioId: usuario.id } },
          update: { rol: datos.rol, activa: true },
          create: { tenantId: negocio.id, usuarioId: usuario.id, rol: datos.rol },
        });
        await tx.membresiaLocal.deleteMany({ where: { membresiaId: membresia.id } });
        await tx.membresiaLocal.createMany({
          data: datos.locales.map((nombre) => ({
            membresiaId: membresia.id,
            localId: locales.get(nombre)!,
            tenantId: negocio.id,
          })),
        });
      }
    });

    console.log(
      `Cevichería Demo lista: 2 locales, ${USUARIOS.length} usuarios (contraseña: SEED_PASSWORD) y una carta de ${PRODUCTOS.length + COMBOS.length} productos.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
