import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { zonaSchema } from '@resto/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap/configure-application';
import { hashearContrasena } from '../../src/infrastructure/crypto/contrasenas';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

/** Zonas de cada local (docs/06_API_CONTRACT.md §7, RF-MES-001 y 003, D12). */

const CONTRASENA = 'contraseña-de-prueba';
const sufijo = randomUUID().slice(0, 8);
const correo = (nombre: string) => `${nombre}-${sufijo}@demo.test`;

const ids = {
  negocioA: randomUUID(),
  negocioB: randomUUID(),
  centro: randomUUID(),
  norte: randomUUID(),
  sur: randomUUID(),
  duena: randomUUID(),
  cajera: randomUUID(),
  mesera: randomUUID(),
  ajena: randomUUID(),
};

let app: INestApplication;
let prisma: PrismaService;
const api = () => request(app.getHttpServer());
const tokens: Record<string, string> = {};
const con = (quien: string) => ({ Authorization: `Bearer ${tokens[quien]}` });
const zonas: Record<string, string> = {};

const activas = async (quien: string, localId: string) =>
  (await api().get('/v1/zonas').set(con(quien)).set('X-Local-Id', localId).expect(200)).body.map(
    (z: { nombre: string }) => z.nombre,
  );

beforeAll(async () => {
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();
  app = modulo.createNestApplication();
  configureApplication(app, { webUrl: 'http://localhost:4000' });
  await app.init();
  prisma = app.get(PrismaService);
  const passwordHash = await hashearContrasena(CONTRASENA);

  await prisma.withoutTenantScope(async (tx) => {
    await tx.negocio.createMany({
      data: [
        { id: ids.negocioA, nombreComercial: `Zonas A ${sufijo}` },
        { id: ids.negocioB, nombreComercial: `Zonas B ${sufijo}` },
      ],
    });
    await tx.local.createMany({
      data: [
        { id: ids.centro, tenantId: ids.negocioA, nombre: 'Centro' },
        { id: ids.norte, tenantId: ids.negocioA, nombre: 'Norte' },
        { id: ids.sur, tenantId: ids.negocioB, nombre: 'Sur' },
      ],
    });
    const personas = [
      { id: ids.duena, nombre: 'duena', rol: 'OWNER' as const, tenant: ids.negocioA, locales: [] },
      {
        id: ids.cajera,
        nombre: 'cajera',
        rol: 'CAJERO' as const,
        tenant: ids.negocioA,
        locales: [ids.centro],
      },
      {
        id: ids.mesera,
        nombre: 'mesera',
        rol: 'MESERO' as const,
        tenant: ids.negocioA,
        locales: [ids.centro],
      },
      { id: ids.ajena, nombre: 'ajena', rol: 'OWNER' as const, tenant: ids.negocioB, locales: [] },
    ];
    for (const p of personas) {
      await tx.usuario.create({
        data: { id: p.id, email: correo(p.nombre), nombre: p.nombre, passwordHash },
      });
      const membresia = await tx.membresia.create({
        data: { usuarioId: p.id, rol: p.rol, tenantId: p.tenant },
      });
      for (const localId of p.locales) {
        await tx.membresiaLocal.create({
          data: { membresiaId: membresia.id, localId, tenantId: p.tenant },
        });
      }
    }
  });
  for (const nombre of ['duena', 'cajera', 'mesera', 'ajena']) {
    const respuesta = await api()
      .post('/v1/auth/login')
      .send({ email: correo(nombre), password: CONTRASENA })
      .expect(200);
    tokens[nombre] = respuesta.body.access_token as string;
  }
});

afterAll(async () => {
  await prisma.withoutTenantScope(async (tx) => {
    await tx.negocio.deleteMany({ where: { id: { in: [ids.negocioA, ids.negocioB] } } });
    await tx.usuario.deleteMany({ where: { email: { endsWith: `-${sufijo}@demo.test` } } });
  });
  await app.close();
});

describe('administración de zonas', () => {
  it('la dueña crea las zonas de un local con su piso', async () => {
    for (const [nombre, piso] of [
      ['Patio de comida', '1er piso'],
      ['Terraza', '2do piso'],
    ] as const) {
      const creada = await api()
        .post(`/v1/locales/${ids.centro}/zonas`)
        .set(con('duena'))
        .send({ nombre, piso })
        .expect(201);
      const zona = zonaSchema.parse(creada.body);
      expect(zona).toMatchObject({ local_id: ids.centro, nombre, piso, activa: true });
      zonas[nombre] = zona.id;
    }
  });

  it('el nombre se repite entre locales, pero no dentro del mismo', async () => {
    await api()
      .post(`/v1/locales/${ids.norte}/zonas`)
      .set(con('duena'))
      .send({ nombre: 'Terraza' })
      .expect(201);
    const repetida = await api()
      .post(`/v1/locales/${ids.centro}/zonas`)
      .set(con('duena'))
      .send({ nombre: 'Terraza' })
      .expect(409);
    expect(repetida.body.error.code).toBe('ZONA_DUPLICADA');
  });

  it('el orden por arrastre y la desactivación se ven en la caja', async () => {
    await api()
      .put(`/v1/locales/${ids.centro}/zonas/orden`)
      .set(con('duena'))
      .send({ ids: [zonas.Terraza, zonas['Patio de comida']] })
      .expect(200);
    expect(await activas('cajera', ids.centro)).toEqual(['Terraza', 'Patio de comida']);

    await api()
      .patch(`/v1/zonas/${zonas.Terraza}`)
      .set(con('duena'))
      .send({ activa: false })
      .expect(200);
    expect(await activas('cajera', ids.centro)).toEqual(['Patio de comida']);

    // La administración sigue viendo la desactivada.
    const todas = await api().get(`/v1/locales/${ids.centro}/zonas`).set(con('duena')).expect(200);
    expect(todas.body.map((z: { nombre: string }) => z.nombre)).toEqual([
      'Terraza',
      'Patio de comida',
    ]);
  });

  it('no se ordenan zonas de otro local con la ruta de este', async () => {
    const norte = await api().get(`/v1/locales/${ids.norte}/zonas`).set(con('duena')).expect(200);
    await api()
      .put(`/v1/locales/${ids.centro}/zonas/orden`)
      .set(con('duena'))
      .send({ ids: [norte.body[0].id as string] })
      .expect(404);
  });

  it('la cajera y la mesera no administran zonas', async () => {
    await api()
      .post(`/v1/locales/${ids.centro}/zonas`)
      .set(con('cajera'))
      .send({ nombre: 'Barra' })
      .expect(403);
    await api()
      .patch(`/v1/zonas/${zonas['Patio de comida']}`)
      .set(con('mesera'))
      .send({ activa: false })
      .expect(403);
  });
});

describe('zonas para operar', () => {
  it('la cajera y la mesera ven las zonas activas de su local', async () => {
    expect(await activas('mesera', ids.centro)).toEqual(['Patio de comida']);
  });

  it('no ven las de otro local (403 LOCAL_NO_ASIGNADO)', async () => {
    const otro = await api()
      .get('/v1/zonas')
      .set(con('cajera'))
      .set('X-Local-Id', ids.norte)
      .expect(403);
    expect(otro.body.error.code).toBe('LOCAL_NO_ASIGNADO');
  });
});

describe('aislamiento', () => {
  it('otro negocio no ve, crea ni edita zonas de A', async () => {
    await api().get(`/v1/locales/${ids.centro}/zonas`).set(con('ajena')).expect(404);
    await api()
      .post(`/v1/locales/${ids.centro}/zonas`)
      .set(con('ajena'))
      .send({ nombre: 'Intrusa' })
      .expect(404);
    await api()
      .patch(`/v1/zonas/${zonas['Patio de comida']}`)
      .set(con('ajena'))
      .send({ nombre: 'Cambiada' })
      .expect(404);
  });
});
