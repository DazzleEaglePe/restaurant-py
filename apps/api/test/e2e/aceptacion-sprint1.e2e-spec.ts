import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { localSchema, miembroSchema, sesionResponseSchema } from '@resto/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap/configure-application';
import { CorreoService, type Correo } from '../../src/infrastructure/correo/correo.service';
import { Cifrador } from '../../src/infrastructure/crypto/cifrado';
import { hashearContrasena } from '../../src/infrastructure/crypto/contrasenas';
import {
  codigoTotp,
  decodificarBase32,
  generarSecretoTotp,
} from '../../src/infrastructure/crypto/totp';
import { PrismaPlataformaService } from '../../src/infrastructure/database/prisma-plataforma.service';

/**
 * Criterios de aceptación del Sprint 1 (docs/10_PLAN_DESARROLLO.md §3), de punta a
 * punta y solo por la API, como lo harían las personas:
 *
 * 1. La plataforma da de alta un negocio e invita a su dueño.
 * 2. El dueño activa su cuenta, crea dos locales e invita a una cajera asignada a uno.
 * 3. La cajera activa su cuenta y opera en su local, pero no en el otro
 *    (`403 LOCAL_NO_ASIGNADO`).
 * 4. Nadie del negocio ve datos de otro negocio.
 */

const sufijo = randomUUID().slice(0, 8);
const emailAdmin = `plataforma-${sufijo}@tabgroup.test`;
const emailDueno = `dueno-${sufijo}@demo.test`;
const emailCajera = `cajera-${sufijo}@demo.test`;
const CONTRASENA_PLATAFORMA = 'clave-de-plataforma-segura';
const CONTRASENA_DUENO = 'ceviche-con-cancha-42';
const CONTRASENA_CAJERA = 'leche-de-tigre-al-paso';
const secreto = generarSecretoTotp();

const enviados: Correo[] = [];
const tokenDe = (para: string) =>
  /token=([A-Za-z0-9_-]+)/.exec(enviados.filter((c) => c.para === para).at(-1)?.texto ?? '')?.[1] ??
  '';

let app: INestApplication;
let plataforma: PrismaPlataformaService;
const api = () => request(app.getHttpServer());
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// Lo que el escenario va construyendo, paso a paso.
const ids = { negocio: '', ajeno: randomUUID(), localAjeno: randomUUID(), centro: '', norte: '' };
let tokenDueno = '';
let tokenCajera = '';

beforeAll(async () => {
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .overrideProvider(CorreoService)
    .useValue({
      enviar: async (c: Correo) => void enviados.push(c),
      enviarSinEsperar: (c: Correo) => void enviados.push(c),
    })
    .compile();
  app = modulo.createNestApplication();
  configureApplication(app, { webUrl: 'http://localhost:4000' });
  await app.init();
  plataforma = app.get(PrismaPlataformaService);

  await plataforma.administradorPlataforma.create({
    data: {
      email: emailAdmin,
      nombre: 'Soporte',
      passwordHash: await hashearContrasena(CONTRASENA_PLATAFORMA),
      totpSecreto: app.get(Cifrador).cifrar(secreto),
    },
  });
  // Otro negocio con su local: lo que nadie del escenario debe ver.
  await plataforma.negocio.create({
    data: { id: ids.ajeno, nombreComercial: `Ajeno ${sufijo}` },
  });
  await plataforma.local.create({
    data: { id: ids.localAjeno, tenantId: ids.ajeno, nombre: 'Centro' },
  });
});

afterAll(async () => {
  await plataforma.negocio.deleteMany({
    where: { id: { in: [ids.ajeno, ...(ids.negocio ? [ids.negocio] : [])] } },
  });
  await plataforma.usuario.deleteMany({ where: { email: { in: [emailDueno, emailCajera] } } });
  await plataforma.administradorPlataforma.deleteMany({ where: { email: emailAdmin } });
  await app.close();
});

describe('Sprint 1 de punta a punta', () => {
  it('la plataforma da de alta el negocio e invita a su dueño', async () => {
    const sesion = await api()
      .post('/platform/v1/auth/login')
      .send({
        email: emailAdmin,
        password: CONTRASENA_PLATAFORMA,
        totp: codigoTotp(decodificarBase32(secreto), Date.now()),
      })
      .expect(200);

    const alta = await api()
      .post('/platform/v1/negocios')
      .set(bearer(sesion.body.access_token as string))
      .send({
        nombre_comercial: `Cevichería Aceptación ${sufijo}`,
        local_inicial: 'Principal',
        owner: { email: emailDueno, nombre: 'Dueña Nueva' },
      })
      .expect(201);

    ids.negocio = alta.body.id as string;
    expect(tokenDe(emailDueno)).not.toBe('');
  });

  it('el dueño invitado activa su cuenta y entra como OWNER', async () => {
    const activada = await api()
      .post('/v1/auth/invitations/accept')
      .send({ token: tokenDe(emailDueno), password: CONTRASENA_DUENO })
      .expect(200);

    const sesion = sesionResponseSchema.parse(activada.body);
    expect(sesion).toMatchObject({ rol: 'OWNER', tenant: { id: ids.negocio } });
    tokenDueno = sesion.access_token;
  });

  it('crea dos locales', async () => {
    for (const nombre of ['Centro', 'Norte']) {
      const creado = await api()
        .post('/v1/locales')
        .set(bearer(tokenDueno))
        .send({ nombre, direccion: null })
        .expect(201);
      ids[nombre === 'Centro' ? 'centro' : 'norte'] = localSchema.parse(creado.body).id;
    }

    const locales = await api().get('/v1/locales').set(bearer(tokenDueno)).expect(200);
    expect(locales.body.map((l: { nombre: string }) => l.nombre).sort()).toEqual([
      'Centro',
      'Norte',
      'Principal',
    ]);
  });

  it('invita a una cajera asignada solo a Centro, que activa su cuenta', async () => {
    const invitada = await api()
      .post('/v1/usuarios/invitaciones')
      .set(bearer(tokenDueno))
      .send({ email: emailCajera, nombre: 'Cajera Nueva', rol: 'CAJERO', local_ids: [ids.centro] })
      .expect(201);
    expect(miembroSchema.parse(invitada.body)).toMatchObject({
      rol: 'CAJERO',
      invitacion_pendiente: true,
      locales: [{ id: ids.centro }],
    });

    const activada = await api()
      .post('/v1/auth/invitations/accept')
      .send({ token: tokenDe(emailCajera), password: CONTRASENA_CAJERA })
      .expect(200);
    const sesion = sesionResponseSchema.parse(activada.body);
    expect(sesion).toMatchObject({ rol: 'CAJERO', locales: [{ id: ids.centro }] });
    tokenCajera = sesion.access_token;
  });

  it('la cajera opera en Centro y no puede operar en Norte (403 LOCAL_NO_ASIGNADO)', async () => {
    const propio = await api()
      .get('/v1/locales/actual')
      .set(bearer(tokenCajera))
      .set('X-Local-Id', ids.centro)
      .expect(200);
    expect(propio.body.nombre).toBe('Centro');

    const otro = await api()
      .get('/v1/locales/actual')
      .set(bearer(tokenCajera))
      .set('X-Local-Id', ids.norte)
      .expect(403);
    expect(otro.body.error.code).toBe('LOCAL_NO_ASIGNADO');
  });

  it('la cajera no administra el equipo', async () => {
    await api().get('/v1/usuarios').set(bearer(tokenCajera)).expect(403);
  });

  it('nadie del negocio ve datos de otro negocio', async () => {
    // Para el dueño, un local de otro negocio no existe, aunque se llame igual.
    const ajeno = await api()
      .get('/v1/locales/actual')
      .set(bearer(tokenDueno))
      .set('X-Local-Id', ids.localAjeno)
      .expect(404);
    expect(ajeno.body.error.code).toBe('NOT_FOUND');

    // La cajera recibe lo mismo que ante cualquier local que no le asignaron:
    // la respuesta no revela que ese local exista en otro negocio.
    const opera = (localId: string) =>
      api().get('/v1/locales/actual').set(bearer(tokenCajera)).set('X-Local-Id', localId);
    const deOtroNegocio = await opera(ids.localAjeno).expect(403);
    const inexistente = await opera(randomUUID()).expect(403);
    expect(deOtroNegocio.body.error.code).toBe('LOCAL_NO_ASIGNADO');
    expect(inexistente.body.error).toMatchObject({
      code: deOtroNegocio.body.error.code,
      message: deOtroNegocio.body.error.message,
    });

    const locales = await api().get('/v1/locales').set(bearer(tokenDueno)).expect(200);
    expect(locales.body.map((l: { id: string }) => l.id)).not.toContain(ids.localAjeno);

    const equipo = await api().get('/v1/usuarios').set(bearer(tokenDueno)).expect(200);
    expect(equipo.body.map((m: { email: string }) => m.email).sort()).toEqual(
      [emailCajera, emailDueno].sort(),
    );

    const negocio = await api().get('/v1/negocio').set(bearer(tokenDueno)).expect(200);
    expect(negocio.body.id).toBe(ids.negocio);
  });
});
