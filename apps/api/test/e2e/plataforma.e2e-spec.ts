import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { negocioPlataformaSchema, sesionPlataformaSchema } from '@resto/contracts';
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
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { PrismaPlataformaService } from '../../src/infrastructure/database/prisma-plataforma.service';

/**
 * Consola de plataforma (RF-PLT-001 y RF-PLT-003, docs/06 §19, docs/07 §11).
 */

const CONTRASENA = 'clave-de-plataforma-segura';
const NUEVA = 'ceviche-con-cancha-42';
const sufijo = randomUUID().slice(0, 8);
const secreto = generarSecretoTotp();
const emailAdmin = `plataforma-${sufijo}@tabgroup.test`;
const emailDueno = `dueno-${sufijo}@demo.test`;
const codigo = () => codigoTotp(decodificarBase32(secreto), Date.now());

const enviados: Correo[] = [];
let app: INestApplication;
let plataforma: PrismaPlataformaService;
const api = () => request(app.getHttpServer());
let tokenPlataforma = '';
let negocioId = '';

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
  configureApplication(app, 'http://localhost:4000');
  await app.init();
  plataforma = app.get(PrismaPlataformaService);

  await plataforma.administradorPlataforma.create({
    data: {
      email: emailAdmin,
      nombre: 'Soporte',
      passwordHash: await hashearContrasena(CONTRASENA),
      totpSecreto: app.get(Cifrador).cifrar(secreto),
    },
  });
});

afterAll(async () => {
  if (negocioId) await plataforma.negocio.deleteMany({ where: { id: negocioId } });
  await plataforma.usuario.deleteMany({ where: { email: emailDueno } });
  await plataforma.administradorPlataforma.deleteMany({ where: { email: emailAdmin } });
  await app.close();
});

describe('POST /platform/v1/auth/login', () => {
  it('exige contraseña y código TOTP', async () => {
    const malCodigo = await api()
      .post('/platform/v1/auth/login')
      .send({ email: emailAdmin, password: CONTRASENA, totp: '000000' })
      .expect(401);
    await api()
      .post('/platform/v1/auth/login')
      .send({ email: emailAdmin, password: 'otra-clave-larga', totp: codigo() })
      .expect(401);
    const ok = await api()
      .post('/platform/v1/auth/login')
      .send({ email: emailAdmin, password: CONTRASENA, totp: codigo() })
      .expect(200);

    expect(malCodigo.body.error.message).toBe('Correo, contraseña o código incorrectos.');
    tokenPlataforma = sesionPlataformaSchema.parse(ok.body).access_token;
  });

  it('el token de plataforma no sirve en la API de los negocios', async () => {
    await api().get('/v1/me').set('Authorization', `Bearer ${tokenPlataforma}`).expect(401);
  });

  it('sin token no se ve la lista de negocios', async () => {
    await api().get('/platform/v1/negocios').expect(401);
  });
});

describe('alta de un negocio (RF-PLT-001)', () => {
  it('crea el negocio con su local e invita al OWNER, que activa su cuenta', async () => {
    const creado = await api()
      .post('/platform/v1/negocios')
      .set('Authorization', `Bearer ${tokenPlataforma}`)
      .send({
        nombre_comercial: `Cevichería Nueva ${sufijo}`,
        local_inicial: 'Principal',
        owner: { email: emailDueno, nombre: 'Dueño Nuevo' },
      })
      .expect(201);
    const negocio = negocioPlataformaSchema.parse(creado.body);
    negocioId = negocio.id;
    expect(negocio).toMatchObject({
      estado: 'ACTIVO',
      locales: 1,
      duenos: [{ email: emailDueno, invitacion_pendiente: true }],
    });

    const invitacion = enviados.find((c) => c.para === emailDueno);
    const enlace = /token=([A-Za-z0-9_-]+)/.exec(invitacion?.texto ?? '')?.[1];
    const sesion = await api()
      .post('/v1/auth/invitations/accept')
      .send({ token: enlace, password: NUEVA })
      .expect(200);
    expect(sesion.body).toMatchObject({
      rol: 'OWNER',
      tenant: { id: negocioId },
      locales: [{ nombre: 'Principal' }],
    });

    const auditoria = await app
      .get(PrismaService)
      .withTenant(negocioId, (tx) =>
        tx.auditoria.findFirst({ where: { accion: 'negocio.creado' } }),
      );
    expect(auditoria).toMatchObject({ actorTipo: 'PLATAFORMA' });
  });

  it('el token de un negocio no abre la consola', async () => {
    const dueno = await api()
      .post('/v1/auth/login')
      .send({ email: emailDueno, password: NUEVA })
      .expect(200);
    await api()
      .get('/platform/v1/negocios')
      .set('Authorization', `Bearer ${dueno.body.access_token as string}`)
      .expect(401);
  });
});

describe('suspensión (RF-PLT-003)', () => {
  it('suspender cierra las sesiones y bloquea el ingreso; reactivar lo devuelve', async () => {
    const dueno = await api()
      .post('/v1/auth/login')
      .send({ email: emailDueno, password: NUEVA })
      .expect(200);
    const cookie = String(dueno.headers['set-cookie']).split(';')[0]!;
    const autorizacion = `Bearer ${tokenPlataforma}`;

    await api()
      .post(`/platform/v1/negocios/${negocioId}/suspender`)
      .set('Authorization', autorizacion)
      .expect(204);
    await api().post('/v1/auth/refresh').set('Cookie', cookie).expect(401);
    await api().post('/v1/auth/login').send({ email: emailDueno, password: NUEVA }).expect(403);

    await api()
      .post(`/platform/v1/negocios/${negocioId}/reactivar`)
      .set('Authorization', autorizacion)
      .expect(204);
    await api().post('/v1/auth/login').send({ email: emailDueno, password: NUEVA }).expect(200);

    const acciones = await app
      .get(PrismaService)
      .withTenant(negocioId, (tx) =>
        tx.auditoria.findMany({ where: { actorTipo: 'PLATAFORMA' }, select: { accion: true } }),
      );
    expect(acciones.map((a) => a.accion).sort()).toEqual([
      'negocio.creado',
      'negocio.reactivado',
      'negocio.suspendido',
    ]);
  });

  it('un negocio que no existe responde 404', async () => {
    await api()
      .post(`/platform/v1/negocios/${randomUUID()}/suspender`)
      .set('Authorization', `Bearer ${tokenPlataforma}`)
      .expect(404);
  });
});
