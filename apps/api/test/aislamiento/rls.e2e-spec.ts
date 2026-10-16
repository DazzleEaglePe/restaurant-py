import { randomUUID } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Environment } from '../../src/config/env.schema';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

/**
 * Aislamiento entre negocios a nivel de motor (docs/05_MODELO_DATOS.md §4 y
 * docs/07_SEGURIDAD_AUTH.md §5). Corre con el rol de la aplicación: si alguna
 * prueba falla, un negocio podría ver o tocar datos de otro.
 */

const url = process.env.DATABASE_URL ?? 'postgresql://resto_app:resto_app_dev@localhost:5433/resto';
const prisma = new PrismaService({
  get: () => url,
} as unknown as ConfigService<Environment, true>);

const sufijo = randomUUID().slice(0, 8);
const ids = {
  negocioA: randomUUID(),
  negocioB: randomUUID(),
  localA: randomUUID(),
  localB: randomUUID(),
  membresiaA: randomUUID(),
  usuario: randomUUID(),
};

beforeAll(async () => {
  await prisma.withoutTenantScope(async (tx) => {
    await tx.negocio.createMany({
      data: [
        { id: ids.negocioA, nombreComercial: `Negocio A ${sufijo}` },
        { id: ids.negocioB, nombreComercial: `Negocio B ${sufijo}` },
      ],
    });
    await tx.local.createMany({
      data: [
        { id: ids.localA, tenantId: ids.negocioA, nombre: 'Local A' },
        { id: ids.localB, tenantId: ids.negocioB, nombre: 'Local B' },
      ],
    });
    await tx.usuario.create({
      data: { id: ids.usuario, email: `aislamiento-${sufijo}@demo.test`, nombre: 'Prueba' },
    });
    await tx.membresia.create({
      data: { id: ids.membresiaA, tenantId: ids.negocioA, usuarioId: ids.usuario, rol: 'CAJERO' },
    });
    await tx.auditoria.create({
      data: {
        tenantId: ids.negocioB,
        accion: 'prueba.aislamiento',
        actorTipo: 'SISTEMA',
        recursoTipo: 'negocio',
      },
    });
  });
});

afterAll(async () => {
  await prisma.withoutTenantScope(async (tx) => {
    // Borrar el negocio arrastra sus filas por ON DELETE CASCADE.
    await tx.negocio.deleteMany({ where: { id: { in: [ids.negocioA, ids.negocioB] } } });
    await tx.usuario.deleteMany({ where: { id: ids.usuario } });
  });
  await prisma.$disconnect();
});

describe('rol de la aplicación', () => {
  it('no es superusuario ni puede saltarse RLS', async () => {
    const [rol] = await prisma.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;

    expect(rol).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('toda tabla con tenant_id, y negocios, tiene RLS activado y forzado', async () => {
    const tablas = await prisma.$queryRaw<
      Array<{ tabla: string; activado: boolean; forzado: boolean }>
    >`
      SELECT c.relname AS tabla, c.relrowsecurity AS activado, c.relforcerowsecurity AS forzado
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND (c.relname = 'negocios' OR EXISTS (
          SELECT 1 FROM information_schema.columns col
          WHERE col.table_schema = 'public' AND col.table_name = c.relname
            AND col.column_name = 'tenant_id'))
      ORDER BY 1`;

    expect(tablas.length).toBeGreaterThanOrEqual(5);
    expect(tablas.filter((t) => !t.activado || !t.forzado)).toEqual([]);
  });
});

describe('sin contexto de negocio', () => {
  it('no se ve ninguna fila', async () => {
    await expect(prisma.negocio.count()).resolves.toBe(0);
    await expect(prisma.local.count()).resolves.toBe(0);
    await expect(prisma.membresia.count()).resolves.toBe(0);
    await expect(prisma.auditoria.count()).resolves.toBe(0);
  });

  it('el contexto de una transacción no pasa a la siguiente consulta', async () => {
    await prisma.withTenant(ids.negocioA, (tx) => tx.local.count());

    await expect(prisma.local.count()).resolves.toBe(0);
  });
});

describe('con el negocio A como contexto', () => {
  it('solo ve su negocio y sus locales', async () => {
    const vistos = await prisma.withTenant(ids.negocioA, async (tx) => ({
      negocios: (await tx.negocio.findMany()).map((n) => n.id),
      locales: (await tx.local.findMany()).map((l) => l.id),
    }));

    expect(vistos).toEqual({ negocios: [ids.negocioA], locales: [ids.localA] });
  });

  it('no encuentra un local de B aunque conozca su id', async () => {
    await expect(
      prisma.withTenant(ids.negocioA, (tx) => tx.local.findUnique({ where: { id: ids.localB } })),
    ).resolves.toBeNull();
  });

  it('no puede crear filas para B', async () => {
    await expect(
      prisma.withTenant(ids.negocioA, (tx) =>
        tx.local.create({ data: { tenantId: ids.negocioB, nombre: 'Intruso' } }),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('no puede modificar ni borrar filas de B', async () => {
    const resultado = await prisma.withTenant(ids.negocioA, async (tx) => ({
      actualizados: (
        await tx.local.updateMany({ where: { id: ids.localB }, data: { nombre: 'Tomado' } })
      ).count,
      borrados: (await tx.negocio.deleteMany({ where: { id: ids.negocioB } })).count,
    }));

    expect(resultado).toEqual({ actualizados: 0, borrados: 0 });
    const localB = await prisma.withTenant(ids.negocioB, (tx) =>
      tx.local.findUnique({ where: { id: ids.localB } }),
    );
    expect(localB?.nombre).toBe('Local B');
  });

  it('no ve la auditoría de B', async () => {
    await expect(prisma.withTenant(ids.negocioA, (tx) => tx.auditoria.count())).resolves.toBe(0);
  });
});

describe('integridad entre negocios', () => {
  it('una membresía de A no puede asignarse a un local de B, ni sin contexto', async () => {
    await expect(
      prisma.withoutTenantScope((tx) =>
        tx.membresiaLocal.create({
          data: { membresiaId: ids.membresiaA, localId: ids.localB, tenantId: ids.negocioA },
        }),
      ),
    ).rejects.toThrow(/Foreign key constraint/);
  });
});

describe('auditoría', () => {
  it('la aplicación registra pero no modifica ni borra', async () => {
    const resultado = await prisma.withTenant(ids.negocioB, async (tx) => ({
      actualizados: (await tx.auditoria.updateMany({ data: { accion: 'alterada' } })).count,
      borrados: (await tx.auditoria.deleteMany()).count,
    }));

    expect(resultado).toEqual({ actualizados: 0, borrados: 0 });
    const acciones = await prisma.withTenant(ids.negocioB, (tx) =>
      tx.auditoria.findMany({ select: { accion: true } }),
    );
    expect(acciones).toEqual([{ accion: 'prueba.aislamiento' }]);
  });
});
