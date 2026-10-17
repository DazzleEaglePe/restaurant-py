import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { miembroSchema, sesionResponseSchema } from '@resto/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap/configure-application';
import { CorreoService, type Correo } from '../../src/infrastructure/correo/correo.service';
import { hashearContrasena } from '../../src/infrastructure/crypto/contrasenas';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { COOKIE_REFRESH } from '../../src/modules/auth/auth.controller';

/**
 * Invitaciones y recuperación de contraseña (RF-AUTH-004 y RF-AUTH-006,
 * docs/06 §2 y §4, docs/07 §2.3). El correo se captura en memoria para seguir
 * el enlace como lo haría la persona.
 */

const CONTRASENA = 'contraseña-de-prueba';
const NUEVA = 'ceviche-con-cancha-42';
const sufijo = randomUUID().slice(0, 8);
const correo = (nombre: string) => `${nombre}-${sufijo}@demo.test`;

const ids = {
  negocio: randomUUID(),
  otroNegocio: randomUUID(),
  centro: randomUUID(),
  admin: randomUUID(),
  duena: randomUUID(),
  cajera: randomUUID(),
  externa: randomUUID(),
};

const enviados: Correo[] = [];
const correoFalso = {
  enviar: async (c: Correo) => void enviados.push(c),
  enviarSinEsperar: (c: Correo) => void enviados.push(c),
};

let app: INestApplication;
let prisma: PrismaService;
const api = () => request(app.getHttpServer());

const tokenDe = (c: Correo | undefined) => /token=([A-Za-z0-9_-]+)/.exec(c?.texto ?? '')?.[1] ?? '';
const ultimoPara = (email: string) => enviados.filter((c) => c.para === email).at(-1);

async function token(nombre: string, password = CONTRASENA): Promise<string> {
  const respuesta = await api()
    .post('/v1/auth/login')
    .send({ email: correo(nombre), password })
    .expect(200);
  return `Bearer ${respuesta.body.access_token as string}`;
}

beforeAll(async () => {
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .overrideProvider(CorreoService)
    .useValue(correoFalso)
    .compile();
  app = modulo.createNestApplication();
  configureApplication(app, 'http://localhost:4000');
  await app.init();
  prisma = app.get(PrismaService);
  const passwordHash = await hashearContrasena(CONTRASENA);

  await prisma.withoutTenantScope(async (tx) => {
    await tx.negocio.createMany({
      data: [
        { id: ids.negocio, nombreComercial: `Cevichería ${sufijo}` },
        { id: ids.otroNegocio, nombreComercial: `Otro ${sufijo}` },
      ],
    });
    await tx.local.create({ data: { id: ids.centro, tenantId: ids.negocio, nombre: 'Centro' } });
    await tx.usuario.createMany({
      data: [
        { id: ids.admin, email: correo('admin'), nombre: 'Admin', passwordHash },
        { id: ids.duena, email: correo('duena'), nombre: 'Dueña', passwordHash },
        { id: ids.cajera, email: correo('cajera'), nombre: 'Cajera', passwordHash },
        { id: ids.externa, email: correo('externa'), nombre: 'Externa', passwordHash },
      ],
    });
    await tx.membresia.createMany({
      data: [
        { usuarioId: ids.admin, tenantId: ids.negocio, rol: 'ADMIN' },
        { usuarioId: ids.duena, tenantId: ids.negocio, rol: 'OWNER' },
        { usuarioId: ids.externa, tenantId: ids.otroNegocio, rol: 'OWNER' },
      ],
    });
    const cajera = await tx.membresia.create({
      data: { usuarioId: ids.cajera, tenantId: ids.negocio, rol: 'CAJERO' },
    });
    await tx.membresiaLocal.create({
      data: { membresiaId: cajera.id, localId: ids.centro, tenantId: ids.negocio },
    });
  });
});

beforeEach(() => {
  enviados.length = 0;
});

afterAll(async () => {
  await prisma.withoutTenantScope(async (tx) => {
    await tx.negocio.deleteMany({ where: { id: { in: [ids.negocio, ids.otroNegocio] } } });
    await tx.usuario.deleteMany({ where: { email: { endsWith: `-${sufijo}@demo.test` } } });
  });
  await app.close();
});

const invitar = async (autorizacion: string, datos: Record<string, unknown>) =>
  api().post('/v1/usuarios/invitaciones').set('Authorization', autorizacion).send(datos);

describe('invitación de una persona nueva (RF-AUTH-006)', () => {
  it('la invita, activa su cuenta con el enlace y entra', async () => {
    const respuesta = await invitar(await token('admin'), {
      email: correo('rosa'),
      nombre: 'Rosa',
      rol: 'CAJERO',
      local_ids: [ids.centro],
    });
    expect(respuesta.status).toBe(201);
    expect(miembroSchema.parse(respuesta.body)).toMatchObject({
      nombre: 'Rosa',
      rol: 'CAJERO',
      invitacion_pendiente: true,
      locales: [{ id: ids.centro, nombre: 'Centro' }],
    });

    const invitacion = ultimoPara(correo('rosa'));
    expect(invitacion?.asunto).toBe(`Te invitaron a Cevichería ${sufijo}`);
    expect(invitacion?.texto).toContain('http://localhost:4000/activar?token=');
    expect(invitacion?.html).toContain('Activar mi cuenta');

    // Todavía no tiene contraseña.
    await api()
      .post('/v1/auth/login')
      .send({ email: correo('rosa'), password: NUEVA })
      .expect(401);

    // Una contraseña común se rechaza y el enlace sigue sirviendo.
    const debil = await api()
      .post('/v1/auth/invitations/accept')
      .send({ token: tokenDe(invitacion), password: 'qwertyuiop' })
      .expect(400);
    expect(debil.body.error.code).toBe('CONTRASENA_DEBIL');

    const activada = await api()
      .post('/v1/auth/invitations/accept')
      .send({ token: tokenDe(invitacion), password: NUEVA })
      .expect(200);
    expect(sesionResponseSchema.parse(activada.body)).toMatchObject({
      rol: 'CAJERO',
      tenant: { id: ids.negocio },
      locales: [{ id: ids.centro }],
    });
    expect(String(activada.headers['set-cookie'])).toContain(`${COOKIE_REFRESH}=`);

    const reusada = await api()
      .post('/v1/auth/invitations/accept')
      .send({ token: tokenDe(invitacion), password: NUEVA })
      .expect(400);
    expect(reusada.body.error.code).toBe('ENLACE_INVALIDO');
    await api()
      .post('/v1/auth/login')
      .send({ email: correo('rosa'), password: NUEVA })
      .expect(200);

    const auditoria = await prisma.withTenant(ids.negocio, (tx) =>
      tx.auditoria.count({ where: { accion: 'usuarios.invitado', actorId: ids.admin } }),
    );
    expect(auditoria).toBeGreaterThanOrEqual(1);
  });

  it('el mismo correo no se invita dos veces', async () => {
    const respuesta = await invitar(await token('admin'), {
      email: correo('cajera'),
      nombre: 'Cajera',
      rol: 'CAJERO',
      local_ids: [ids.centro],
    });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('YA_ES_MIEMBRO');
  });

  it('una cuenta de otro negocio queda agregada sin pedir contraseña nueva', async () => {
    const respuesta = await invitar(await token('admin'), {
      email: correo('externa'),
      nombre: 'Externa',
      rol: 'ADMIN',
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.invitacion_pendiente).toBe(false);
    expect(ultimoPara(correo('externa'))?.asunto).toBe(`Ahora eres parte de Cevichería ${sufijo}`);
    expect(tokenDe(ultimoPara(correo('externa')))).toBe('');
  });

  it('respeta los roles de docs/02 §3.1', async () => {
    const admin = await token('admin');
    const aDueno = await invitar(admin, {
      email: correo('otro-dueno'),
      nombre: 'Otro',
      rol: 'OWNER',
    });
    const desdeCaja = await invitar(await token('cajera'), {
      email: correo('x'),
      nombre: 'X',
      rol: 'MESERO',
      local_ids: [ids.centro],
    });
    const sinLocal = await invitar(admin, {
      email: correo('sin-local'),
      nombre: 'Sin',
      rol: 'CAJERO',
    });

    expect(aDueno.status).toBe(403);
    expect(desdeCaja.status).toBe(403);
    expect(sinLocal.status).toBe(400);
    expect(enviados).toEqual([]);
  });

  it('reenviar invitación anula el enlace anterior', async () => {
    const admin = await token('admin');
    const invitada = await invitar(admin, {
      email: correo('lucia'),
      nombre: 'Lucía',
      rol: 'MESERO',
      local_ids: [ids.centro],
    });
    const primero = tokenDe(ultimoPara(correo('lucia')));

    await api()
      .post(`/v1/usuarios/${invitada.body.id as string}/invitacion`)
      .set('Authorization', admin)
      .expect(204);
    const segundo = tokenDe(ultimoPara(correo('lucia')));

    expect(segundo).not.toBe(primero);
    await api()
      .post('/v1/auth/invitations/accept')
      .send({ token: primero, password: NUEVA })
      .expect(400);
    await api()
      .post('/v1/auth/invitations/accept')
      .send({ token: segundo, password: NUEVA })
      .expect(200);
    const yaActiva = await api()
      .post(`/v1/usuarios/${invitada.body.id as string}/invitacion`)
      .set('Authorization', admin)
      .expect(409);
    expect(yaActiva.body.error.code).toBe('INVITACION_YA_ACEPTADA');
  });

  it('un enlace vencido no sirve', async () => {
    const invitada = await invitar(await token('admin'), {
      email: correo('vencida'),
      nombre: 'Vencida',
      rol: 'ADMIN',
    });
    await prisma.withoutTenantScope((tx) =>
      tx.tokenUnUso.updateMany({
        where: { usuarioId: invitada.body.id as string },
        data: { expiraAt: new Date(Date.now() - 1000) },
      }),
    );

    await api()
      .post('/v1/auth/invitations/accept')
      .send({ token: tokenDe(ultimoPara(correo('vencida'))), password: NUEVA })
      .expect(400);
  });
});

describe('recuperación de contraseña (RF-AUTH-004)', () => {
  it('responde 202 exista o no la cuenta, y solo escribe a la que existe', async () => {
    await api()
      .post('/v1/auth/password/forgot')
      .send({ email: correo('cajera') })
      .expect(202);
    await api()
      .post('/v1/auth/password/forgot')
      .send({ email: correo('nadie') })
      .expect(202);

    expect(enviados.map((c) => c.para)).toEqual([correo('cajera')]);
    expect(enviados[0]?.texto).toContain('http://localhost:4000/recuperar?token=');
  });

  it('cambia la contraseña, cierra las sesiones y el enlace no se reusa', async () => {
    const sesion = await api()
      .post('/v1/auth/login')
      .send({ email: correo('cajera'), password: CONTRASENA })
      .expect(200);
    const cookie = String(sesion.headers['set-cookie']).split(';')[0]!;

    await api()
      .post('/v1/auth/password/forgot')
      .send({ email: correo('cajera') })
      .expect(202);
    const enlace = tokenDe(ultimoPara(correo('cajera')));

    const debil = await api()
      .post('/v1/auth/password/reset')
      .send({ token: enlace, password: correo('cajera') })
      .expect(400);
    expect(debil.body.error.code).toBe('CONTRASENA_DEBIL');
    await api()
      .post('/v1/auth/password/reset')
      .send({ token: enlace, password: NUEVA })
      .expect(204);

    await api().post('/v1/auth/refresh').set('Cookie', cookie).expect(401);
    await api()
      .post('/v1/auth/login')
      .send({ email: correo('cajera'), password: CONTRASENA })
      .expect(401);
    await api()
      .post('/v1/auth/login')
      .send({ email: correo('cajera'), password: NUEVA })
      .expect(200);
    await api()
      .post('/v1/auth/password/reset')
      .send({ token: enlace, password: NUEVA })
      .expect(400);
  });
});
