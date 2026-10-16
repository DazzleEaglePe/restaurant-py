import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { healthResponseSchema } from '@resto/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap/configure-application';

describe('GET /v1/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app, 'http://localhost:4000');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde según el contrato', async () => {
    const respuesta = await request(app.getHttpServer()).get('/v1/health').expect(200);

    expect(healthResponseSchema.parse(respuesta.body).service).toBe('resto-api');
  });

  it('solo admite CORS desde la web', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/v1/health')
      .set('Origin', 'http://localhost:4000');

    expect(respuesta.headers['access-control-allow-origin']).toBe('http://localhost:4000');
    expect(respuesta.headers['access-control-allow-credentials']).toBe('true');
  });

  it('las rutas fuera de /v1 no existen', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});
