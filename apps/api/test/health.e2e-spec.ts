import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { healthResponseSchema, readinessResponseSchema } from '@resto/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap/configure-application';
import { PrismaService } from '../src/infrastructure/database/prisma.service';

// Estas pruebas no necesitan PostgreSQL: la base se reemplaza por un doble que
// responde o falla según `baseDisponible`.
let baseDisponible = true;
const prismaFalso = {
  $queryRaw: () =>
    baseDisponible ? Promise.resolve([{ '?column?': 1 }]) : Promise.reject(new Error('caída')),
  $disconnect: () => Promise.resolve(),
};

describe('Health API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaFalso)
      .compile();
    app = moduleRef.createNestApplication();
    configureApplication(app, {
      webUrl: 'http://localhost:4000',
      plataformaUrl: 'http://localhost:4002',
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health responde según el contrato', async () => {
    const respuesta = await request(app.getHttpServer()).get('/v1/health').expect(200);

    expect(healthResponseSchema.parse(respuesta.body).service).toBe('resto-api');
  });

  it('GET /v1/health/ready responde 200 con la base disponible', async () => {
    baseDisponible = true;
    const respuesta = await request(app.getHttpServer()).get('/v1/health/ready').expect(200);

    expect(readinessResponseSchema.parse(respuesta.body)).toEqual({
      status: 'ok',
      checks: { database: 'up' },
    });
  });

  it('GET /v1/health/ready responde 503 si la base no responde', async () => {
    baseDisponible = false;
    const respuesta = await request(app.getHttpServer()).get('/v1/health/ready').expect(503);

    expect(respuesta.body).toEqual({ status: 'error', checks: { database: 'down' } });
  });

  it('solo admite CORS desde la web', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/v1/health')
      .set('Origin', 'http://localhost:4000');

    expect(respuesta.headers['access-control-allow-origin']).toBe('http://localhost:4000');
    expect(respuesta.headers['access-control-allow-credentials']).toBe('true');
  });

  it('la consola no puede leer la API de los negocios', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/v1/health')
      .set('Origin', 'http://localhost:4002');

    expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('la API de plataforma admite CORS solo desde la consola y sin credenciales', async () => {
    const preflight = (origen: string) =>
      request(app.getHttpServer())
        .options('/platform/v1/negocios')
        .set('Origin', origen)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type');

    const consola = await preflight('http://localhost:4002');
    expect(consola.headers['access-control-allow-origin']).toBe('http://localhost:4002');
    expect(consola.headers['access-control-allow-credentials']).toBeUndefined();

    const web = await preflight('http://localhost:4000');
    expect(web.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('las rutas fuera de /v1 no existen', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});
