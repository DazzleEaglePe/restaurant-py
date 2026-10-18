import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { localSchema, miembroSchema, negocioSchema } from '@resto/contracts';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap/configure-application';
import { hashearContrasena } from '../../src/infrastructure/crypto/contrasenas';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { COOKIE_REFRESH } from '../../src/modules/auth/auth.controller';

/**
 * Roles, locales y equipo (docs/02 §3.1, docs/06 §3 y §4, docs/07 §4).
 */

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
  duena2: randomUUID(),
  admin: randomUUID(),
  cajera: randomUUID(),
  mesera: randomUUID(),
  ajena: randomUUID(),
};

let app: INestApplication;
let prisma: PrismaService;

type Credenciales = { token: string; cookie: string };

async function ingresar(nombre: string): Promise<Credenciales> {
  const respuesta = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email: correo(nombre), password: CONTRASENA })
    .expect(200);
  const cookie = ([] as string[])
    .concat(respuesta.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith(`${COOKIE_REFRESH}=`))!
    .split(';')[0]!;
  return { token: respuesta.body.access_token, cookie };
}

const api = () => request(app.getHttpServer());
const con = (credenciales: Credenciales) => ({ Authorization: `Bearer ${credenciales.token}` });

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
        { id: ids.negocioA, nombreComercial: `Negocio A ${sufijo}` },
        { id: ids.negocioB, nombreComercial: `Negocio B ${sufijo}` },
      ],
    });
    await tx.local.createMany({
      data: [
        { id: ids.centro, tenantId: ids.negocioA, nombre: 'Centro' },
        { id: ids.norte, tenantId: ids.negocioA, nombre: 'Norte' },
        { id: ids.sur, tenantId: ids.negocioB, nombre: 'Sur' },
      ],
    });
    const usuarios: Array<[keyof typeof ids, string]> = [
      ['duena', 'duena'],
      ['duena2', 'duena2'],
      ['admin', 'admin'],
      ['cajera', 'cajera'],
      ['mesera', 'mesera'],
      ['ajena', 'ajena'],
    ];
    await tx.usuario.createMany({
      data: usuarios.map(([id, nombre]) => ({
        id: ids[id],
        email: correo(nombre),
        nombre,
        passwordHash,
      })),
    });
    const membresias = [
      { usuarioId: ids.duena, rol: 'OWNER' as const, tenantId: ids.negocioA, locales: [] },
      { usuarioId: ids.duena2, rol: 'OWNER' as const, tenantId: ids.negocioA, locales: [] },
      { usuarioId: ids.admin, rol: 'ADMIN' as const, tenantId: ids.negocioA, locales: [] },
      {
        usuarioId: ids.cajera,
        rol: 'CAJERO' as const,
        tenantId: ids.negocioA,
        locales: [ids.centro],
      },
      {
        usuarioId: ids.mesera,
        rol: 'MESERO' as const,
        tenantId: ids.negocioA,
        locales: [ids.centro],
      },
      { usuarioId: ids.ajena, rol: 'OWNER' as const, tenantId: ids.negocioB, locales: [] },
    ];
    for (const { locales, ...datos } of membresias) {
      const membresia = await tx.membresia.create({ data: datos });
      for (const localId of locales) {
        await tx.membresiaLocal.create({
          data: { membresiaId: membresia.id, localId, tenantId: datos.tenantId },
        });
      }
    }
  });
  // La dueña también es ADMIN en B. Se crea en otra transacción para que su
  // membresía en A sea la más antigua y el ingreso la elija.
  await prisma.withoutTenantScope((tx) =>
    tx.membresia.create({ data: { usuarioId: ids.duena, rol: 'ADMIN', tenantId: ids.negocioB } }),
  );
});

afterAll(async () => {
  await prisma.withoutTenantScope(async (tx) => {
    await tx.negocio.deleteMany({ where: { id: { in: [ids.negocioA, ids.negocioB] } } });
    await tx.usuario.deleteMany({ where: { email: { endsWith: `-${sufijo}@demo.test` } } });
  });
  await app.close();
});

describe('GET /v1/locales', () => {
  it('la cajera ve su local y la dueña todos', async () => {
    const cajera = await api()
      .get('/v1/locales')
      .set(con(await ingresar('cajera')))
      .expect(200);
    const duena = await api()
      .get('/v1/locales')
      .set(con(await ingresar('duena')))
      .expect(200);

    expect(cajera.body.map((l: { nombre: string }) => l.nombre)).toEqual(['Centro']);
    expect(duena.body.map((l: { nombre: string }) => l.nombre)).toEqual(['Centro', 'Norte']);
    expect(() => localSchema.array().parse(duena.body)).not.toThrow();
  });
});

describe('X-Local-Id en rutas de operación', () => {
  it('la cajera opera en su local', async () => {
    const respuesta = await api()
      .get('/v1/locales/actual')
      .set(con(await ingresar('cajera')))
      .set('X-Local-Id', ids.centro)
      .expect(200);

    expect(respuesta.body.nombre).toBe('Centro');
  });

  it('la cajera no puede operar en otro local (403 LOCAL_NO_ASIGNADO)', async () => {
    const respuesta = await api()
      .get('/v1/locales/actual')
      .set(con(await ingresar('cajera')))
      .set('X-Local-Id', ids.norte)
      .expect(403);

    expect(respuesta.body.error.code).toBe('LOCAL_NO_ASIGNADO');
  });

  it('sin la cabecera responde 400', async () => {
    const respuesta = await api()
      .get('/v1/locales/actual')
      .set(con(await ingresar('cajera')))
      .expect(400);

    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('un local de otro negocio responde 404, aunque sea dueña', async () => {
    const respuesta = await api()
      .get('/v1/locales/actual')
      .set(con(await ingresar('duena')))
      .set('X-Local-Id', ids.sur)
      .expect(404);

    expect(respuesta.body.error.code).toBe('NOT_FOUND');
  });
});

describe('locales (ADMIN)', () => {
  it('la cajera no crea locales', async () => {
    const respuesta = await api()
      .post('/v1/locales')
      .set(con(await ingresar('cajera')))
      .send({ nombre: 'Prohibido' })
      .expect(403);

    expect(respuesta.body.error.code).toBe('FORBIDDEN');
  });

  it('el admin crea un local; el nombre no se repite', async () => {
    const admin = await ingresar('admin');
    const creado = await api()
      .post('/v1/locales')
      .set(con(admin))
      .send({ nombre: 'Playa', ventana_pagos_min: 20 })
      .expect(201);
    const duplicado = await api()
      .post('/v1/locales')
      .set(con(admin))
      .send({ nombre: 'Playa' })
      .expect(409);

    expect(localSchema.parse(creado.body)).toMatchObject({
      nombre: 'Playa',
      ventana_pagos_min: 20,
      costo_taper_defecto: '1.00',
    });
    expect(duplicado.body.error.code).toBe('LOCAL_DUPLICADO');
  });

  it('el admin edita la configuración dentro de los rangos de docs/05', async () => {
    const admin = await ingresar('admin');
    const editado = await api()
      .patch(`/v1/locales/${ids.centro}`)
      .set(con(admin))
      .send({ ventana_pagos_min: 30, monto_max_constancia: '150.00' })
      .expect(200);
    const fueraDeRango = await api()
      .patch(`/v1/locales/${ids.centro}`)
      .set(con(admin))
      .send({ ventana_pagos_min: 90 })
      .expect(400);

    expect(editado.body).toMatchObject({ ventana_pagos_min: 30, monto_max_constancia: '150.00' });
    expect(fueraDeRango.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('un local de otro negocio no se puede editar', async () => {
    await api()
      .patch(`/v1/locales/${ids.sur}`)
      .set(con(await ingresar('admin')))
      .send({ nombre: 'Tomado' })
      .expect(404);
  });
});

describe('negocio', () => {
  it('el admin lo ve pero solo la dueña lo edita', async () => {
    const admin = await ingresar('admin');
    const negocio = await api().get('/v1/negocio').set(con(admin)).expect(200);
    await api().patch('/v1/negocio').set(con(admin)).send({ color_acento: '#123456' }).expect(403);
    const editado = await api()
      .patch('/v1/negocio')
      .set(con(await ingresar('duena')))
      .send({ color_acento: '#FF6B57', ruc: '20123456789' })
      .expect(200);

    expect(negocioSchema.parse(negocio.body).id).toBe(ids.negocioA);
    expect(editado.body).toMatchObject({ color_acento: '#FF6B57', ruc: '20123456789' });
  });

  it('la cajera no ve los datos del negocio', async () => {
    await api()
      .get('/v1/negocio')
      .set(con(await ingresar('cajera')))
      .expect(403);
  });
});

describe('equipo', () => {
  it('el admin lista al equipo; la cajera no', async () => {
    const lista = await api()
      .get('/v1/usuarios')
      .set(con(await ingresar('admin')))
      .expect(200);
    await api()
      .get('/v1/usuarios')
      .set(con(await ingresar('cajera')))
      .expect(403);

    const miembros = miembroSchema.array().parse(lista.body);
    expect(miembros.map((m) => m.rol)).toEqual(['OWNER', 'OWNER', 'ADMIN', 'CAJERO', 'MESERO']);
    expect(miembros.find((m) => m.id === ids.cajera)?.locales).toEqual([
      { id: ids.centro, nombre: 'Centro' },
    ]);
  });

  it('cambiar los locales de la cajera cierra sus sesiones y queda auditado', async () => {
    const cajera = await ingresar('cajera');
    const editado = await api()
      .patch(`/v1/usuarios/${ids.cajera}`)
      .set(con(await ingresar('admin')))
      .send({ local_ids: [ids.norte, ids.centro] })
      .expect(200);

    expect(editado.body.locales.map((l: { nombre: string }) => l.nombre)).toEqual([
      'Centro',
      'Norte',
    ]);
    await api().post('/v1/auth/refresh').set('Cookie', cajera.cookie).expect(401);
    const nuevaSesion = await ingresar('cajera');
    expect(jwt.decode(nuevaSesion.token)).toMatchObject({
      loc: expect.arrayContaining([ids.centro, ids.norte]),
    });
    const auditoria = await prisma.withTenant(ids.negocioA, (tx) =>
      tx.auditoria.findFirst({ where: { accion: 'usuarios.editado', recursoId: ids.cajera } }),
    );
    expect(auditoria?.actorId).toBe(ids.admin);
  });

  it('el admin no toca a una dueña ni nombra dueños', async () => {
    const admin = await ingresar('admin');
    const aDuena = await api()
      .patch(`/v1/usuarios/${ids.duena2}`)
      .set(con(admin))
      .send({ activa: false })
      .expect(403);
    await api()
      .patch(`/v1/usuarios/${ids.mesera}`)
      .set(con(admin))
      .send({ rol: 'OWNER' })
      .expect(403);

    expect(aDuena.body.error.message).toMatch(/dueño/);
  });

  it('nadie cambia su propio rol ni se desactiva', async () => {
    await api()
      .patch(`/v1/usuarios/${ids.duena}`)
      .set(con(await ingresar('duena')))
      .send({ activa: false })
      .expect(403);
  });

  it('un cajero necesita locales de este negocio', async () => {
    const admin = await ingresar('admin');
    await api()
      .patch(`/v1/usuarios/${ids.mesera}`)
      .set(con(admin))
      .send({ local_ids: [] })
      .expect(400);
    await api()
      .patch(`/v1/usuarios/${ids.mesera}`)
      .set(con(admin))
      .send({ local_ids: [ids.sur] })
      .expect(400);
  });

  it('una persona de otro negocio responde 404', async () => {
    await api()
      .patch(`/v1/usuarios/${ids.ajena}`)
      .set(con(await ingresar('admin')))
      .send({ activa: false })
      .expect(404);
  });

  it('una dueña desactiva a otra dueña, que ya no puede entrar', async () => {
    const duena2 = await ingresar('duena2');
    await api()
      .patch(`/v1/usuarios/${ids.duena2}`)
      .set(con(await ingresar('duena')))
      .send({ activa: false })
      .expect(200);

    await api().post('/v1/auth/refresh').set('Cookie', duena2.cookie).expect(401);
    await api()
      .post('/v1/auth/login')
      .send({ email: correo('duena2'), password: CONTRASENA })
      .expect(403);
  });
});

describe('POST /v1/auth/switch-tenant', () => {
  it('la dueña pasa a su otro negocio y la sesión anterior se cierra', async () => {
    const enA = await ingresar('duena');
    expect(jwt.decode(enA.token)).toMatchObject({ tid: ids.negocioA, rol: 'OWNER' });

    const cambio = await api()
      .post('/v1/auth/switch-tenant')
      .set(con(enA))
      .set('Cookie', enA.cookie)
      .send({ tenant_id: ids.negocioB })
      .expect(200);
    const enB = cambio.body.access_token as string;

    expect(jwt.decode(enB)).toMatchObject({ tid: ids.negocioB, rol: 'ADMIN' });
    const me = await api().get('/v1/me').set('Authorization', `Bearer ${enB}`).expect(200);
    expect(me.body.tenant.id).toBe(ids.negocioB);
    await api().post('/v1/auth/refresh').set('Cookie', enA.cookie).expect(401);
  });

  it('no puede entrar a un negocio del que no es parte', async () => {
    const cajera = await ingresar('cajera');
    await api()
      .post('/v1/auth/switch-tenant')
      .set(con(cajera))
      .set('Cookie', cajera.cookie)
      .send({ tenant_id: ids.negocioB })
      .expect(403);
  });
});
