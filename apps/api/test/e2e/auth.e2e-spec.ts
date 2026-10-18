import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { errorResponseSchema, meResponseSchema, sesionResponseSchema } from '@resto/contracts';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap/configure-application';
import { hashearContrasena } from '../../src/infrastructure/crypto/contrasenas';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { COOKIE_REFRESH } from '../../src/modules/auth/auth.controller';

/**
 * Sesión de usuarios contra PostgreSQL real (docs/06_API_CONTRACT.md §2,
 * docs/07_SEGURIDAD_AUTH.md §2, RF-AUTH-001 a 005 y RNF-SEG-007).
 */

const CONTRASENA = 'contraseña-de-prueba';
const sufijo = randomUUID().slice(0, 8);
const correo = (nombre: string) => `${nombre}-${sufijo}@demo.test`;

const ids = {
  negocio: randomUUID(),
  negocioSuspendido: randomUUID(),
  centro: randomUUID(),
  norte: randomUUID(),
  duena: randomUUID(),
  cajera: randomUUID(),
  invitada: randomUUID(),
  suspendida: randomUUID(),
  bloqueable: randomUUID(),
};

async function crearApp(sinLimitePorIp: boolean): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  // El límite de 10 ingresos por minuto por IP se prueba aparte: aquí todas las
  // solicitudes salen de la misma IP.
  if (sinLimitePorIp)
    builder = builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true });
  const app = (await builder.compile()).createNestApplication();
  configureApplication(app, { webUrl: 'http://localhost:4000' });
  await app.init();
  return app;
}

const cookieDe = (respuesta: request.Response): string | undefined =>
  ([] as string[])
    .concat(respuesta.headers['set-cookie'] ?? [])
    .find((cookie) => cookie.startsWith(`${COOKIE_REFRESH}=`));

const valorCookie = (cookie: string | undefined) => cookie?.split(';')[0] ?? '';

let app: INestApplication;
let prisma: PrismaService;

const ingresar = (email: string, password = CONTRASENA) =>
  request(app.getHttpServer()).post('/v1/auth/login').send({ email, password });

beforeAll(async () => {
  app = await crearApp(true);
  prisma = app.get(PrismaService);
  const passwordHash = await hashearContrasena(CONTRASENA);

  await prisma.withoutTenantScope(async (tx) => {
    await tx.negocio.createMany({
      data: [
        { id: ids.negocio, nombreComercial: `Cevichería ${sufijo}` },
        {
          id: ids.negocioSuspendido,
          nombreComercial: `Suspendido ${sufijo}`,
          estado: 'SUSPENDIDO',
        },
      ],
    });
    await tx.local.createMany({
      data: [
        { id: ids.norte, tenantId: ids.negocio, nombre: 'Norte' },
        { id: ids.centro, tenantId: ids.negocio, nombre: 'Centro' },
      ],
    });
    await tx.usuario.createMany({
      data: [
        { id: ids.duena, email: correo('duena'), nombre: 'Dueña', passwordHash },
        { id: ids.cajera, email: correo('cajera'), nombre: 'Rosa', passwordHash },
        { id: ids.invitada, email: correo('invitada'), nombre: 'Invitada' },
        { id: ids.suspendida, email: correo('suspendida'), nombre: 'Suspendida', passwordHash },
        { id: ids.bloqueable, email: correo('bloqueable'), nombre: 'Bloqueable', passwordHash },
      ],
    });
    const membresias = [
      { usuarioId: ids.duena, rol: 'OWNER' as const, tenantId: ids.negocio },
      { usuarioId: ids.cajera, rol: 'CAJERO' as const, tenantId: ids.negocio },
      { usuarioId: ids.invitada, rol: 'CAJERO' as const, tenantId: ids.negocio },
      { usuarioId: ids.suspendida, rol: 'ADMIN' as const, tenantId: ids.negocioSuspendido },
      { usuarioId: ids.bloqueable, rol: 'ADMIN' as const, tenantId: ids.negocio },
    ];
    for (const datos of membresias) {
      const membresia = await tx.membresia.create({ data: datos });
      if (datos.usuarioId === ids.cajera) {
        await tx.membresiaLocal.create({
          data: { membresiaId: membresia.id, localId: ids.centro, tenantId: ids.negocio },
        });
      }
    }
  });
});

afterAll(async () => {
  await prisma.withoutTenantScope(async (tx) => {
    await tx.negocio.deleteMany({ where: { id: { in: [ids.negocio, ids.negocioSuspendido] } } });
    await tx.usuario.deleteMany({
      where: { id: { in: [ids.duena, ids.cajera, ids.invitada, ids.suspendida, ids.bloqueable] } },
    });
  });
  await app.close();
});

describe('POST /v1/auth/login', () => {
  it('la dueña entra con todos los locales y un loc vacío en el token', async () => {
    const respuesta = await ingresar(correo('duena')).expect(200);
    const sesion = sesionResponseSchema.parse(respuesta.body);

    expect(sesion).toMatchObject({
      rol: 'OWNER',
      expires_in: 900,
      tenant: { id: ids.negocio },
      locales: [
        { id: ids.centro, nombre: 'Centro' },
        { id: ids.norte, nombre: 'Norte' },
      ],
    });
    expect(jwt.decode(sesion.access_token)).toMatchObject({
      sub: ids.duena,
      tid: ids.negocio,
      rol: 'OWNER',
      loc: [],
    });
  });

  it('la cajera recibe solo su local, también en el token', async () => {
    const respuesta = await ingresar(correo('cajera')).expect(200);
    const sesion = sesionResponseSchema.parse(respuesta.body);

    expect(sesion.locales).toEqual([{ id: ids.centro, nombre: 'Centro' }]);
    expect(jwt.decode(sesion.access_token)).toMatchObject({ rol: 'CAJERO', loc: [ids.centro] });
  });

  it('deja el refresh token en una cookie HttpOnly, Secure y SameSite=Strict', async () => {
    const cookie = cookieDe(await ingresar(correo('cajera')).expect(200)) ?? '';

    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/v1\/auth/);
  });

  it('responde igual con contraseña equivocada o con un correo que no existe', async () => {
    const equivocada = await ingresar(correo('cajera'), 'otra-contraseña').expect(401);
    const inexistente = await ingresar(correo('nadie')).expect(401);

    for (const respuesta of [equivocada, inexistente]) {
      const { error } = errorResponseSchema.parse(respuesta.body);
      expect(error.code).toBe('UNAUTHENTICATED');
      expect(error.message).toBe('Correo o contraseña incorrectos.');
      expect(error.request_id).toBe(respuesta.headers['x-request-id']);
    }
  });

  it('una invitación sin aceptar no puede entrar', async () => {
    await ingresar(correo('invitada')).expect(401);
  });

  it('un usuario de un negocio suspendido no entra', async () => {
    const respuesta = await ingresar(correo('suspendida')).expect(403);

    expect(respuesta.body.error.code).toBe('FORBIDDEN');
  });

  it('valida el cuerpo', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'no-es-correo' })
      .expect(400);

    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.details.campos.map((c: { campo: string }) => c.campo)).toEqual([
      'email',
      'password',
    ]);
  });

  it('bloquea la cuenta 15 minutos tras 5 intentos fallidos (RF-AUTH-005)', async () => {
    for (let intento = 1; intento <= 5; intento += 1) {
      await ingresar(correo('bloqueable'), 'equivocada').expect(401);
    }
    const bloqueada = await ingresar(correo('bloqueable')).expect(429);

    expect(bloqueada.body.error.code).toBe('CUENTA_BLOQUEADA');
    expect(Number(bloqueada.headers['retry-after'])).toBeGreaterThan(890);
    expect(Number(bloqueada.headers['retry-after'])).toBeLessThanOrEqual(900);

    // Al vencer el bloqueo vuelve a entrar y el contador se reinicia.
    await prisma.withoutTenantScope((tx) =>
      tx.usuario.update({ where: { id: ids.bloqueable }, data: { bloqueadoHasta: new Date(0) } }),
    );
    await ingresar(correo('bloqueable')).expect(200);
    const usuario = await prisma.withoutTenantScope((tx) =>
      tx.usuario.findUniqueOrThrow({ where: { id: ids.bloqueable } }),
    );
    expect(usuario).toMatchObject({ intentosFallidos: 0, bloqueadoHasta: null });
  });
});

describe('GET /v1/me', () => {
  it('devuelve la sesión del token', async () => {
    const { access_token: token } = (await ingresar(correo('cajera')).expect(200)).body;
    const respuesta = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meResponseSchema.parse(respuesta.body)).toMatchObject({
      user: { id: ids.cajera, nombre: 'Rosa' },
      rol: 'CAJERO',
      locales: [{ id: ids.centro }],
    });
  });

  it.each([undefined, 'Bearer no-es-un-token', 'Basic abc'])('rechaza %s', async (cabecera) => {
    const solicitud = request(app.getHttpServer()).get('/v1/me');
    if (cabecera) solicitud.set('Authorization', cabecera);
    const respuesta = await solicitud.expect(401);

    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /v1/auth/refresh', () => {
  it('rota el token y revoca la sesión si reaparece uno ya usado (RF-AUTH-002)', async () => {
    const primera = valorCookie(cookieDe(await ingresar(correo('cajera')).expect(200)));

    const renovada = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', primera)
      .expect(200);
    const segunda = valorCookie(cookieDe(renovada));
    expect(sesionResponseSchema.parse(renovada.body).rol).toBe('CAJERO');
    expect(segunda).not.toBe(primera);

    // Reutilizar la primera cierra toda la sesión, incluida la segunda.
    const reutilizada = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', primera)
      .expect(401);
    expect(reutilizada.body.error.message).toMatch(/seguridad/);
    await request(app.getHttpServer()).post('/v1/auth/refresh').set('Cookie', segunda).expect(401);
  });

  it('sin cookie responde 401', async () => {
    await request(app.getHttpServer()).post('/v1/auth/refresh').expect(401);
  });
});

describe('POST /v1/auth/logout', () => {
  it('cierra la sesión y borra la cookie (RF-AUTH-003)', async () => {
    const cookie = valorCookie(cookieDe(await ingresar(correo('cajera')).expect(200)));

    const salida = await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(204);
    expect(cookieDe(salida)).toMatch(/Expires=Thu, 01 Jan 1970/);

    await request(app.getHttpServer()).post('/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });
});

describe('límite por IP (RNF-SEG-007)', () => {
  it('después de 10 intentos por minuto responde 429', async () => {
    const conLimite = await crearApp(false);
    try {
      for (let intento = 1; intento <= 10; intento += 1) {
        await request(conLimite.getHttpServer())
          .post('/v1/auth/login')
          .send({ email: correo(`limite${intento}`), password: 'x' })
          .expect(401);
      }
      const respuesta = await request(conLimite.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: correo('limite11'), password: 'x' })
        .expect(429);
      expect(respuesta.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    } finally {
      await conLimite.close();
    }
  });
});
