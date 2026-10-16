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
      `Cevichería Demo lista: 2 locales y ${USUARIOS.length} usuarios (contraseña: SEED_PASSWORD).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
