import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { cartaSchema, categoriaSchema, productoSchema, type Carta } from '@resto/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap/configure-application';
import { hashearContrasena } from '../../src/infrastructure/crypto/contrasenas';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

/**
 * Carta: categorías, productos, combos, disponibilidad por local y la carta de la
 * caja (docs/06_API_CONTRACT.md §6, RF-CAR-001 a 011, Sprint 2).
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
  cajera: randomUUID(),
  mesera: randomUUID(),
  ajena: randomUUID(),
  productoAjeno: randomUUID(),
};

let app: INestApplication;
let prisma: PrismaService;
const api = () => request(app.getHttpServer());
const tokens: Record<string, string> = {};
const con = (quien: string) => ({ Authorization: `Bearer ${tokens[quien]}` });

// Lo que el escenario va creando.
const carta: Record<string, string> = {};

async function ingresar(nombre: string): Promise<void> {
  const respuesta = await api()
    .post('/v1/auth/login')
    .send({ email: correo(nombre), password: CONTRASENA })
    .expect(200);
  tokens[nombre] = respuesta.body.access_token as string;
}

const leerCarta = async (quien: string, localId: string): Promise<Carta> =>
  cartaSchema.parse(
    (await api().get('/v1/carta').set(con(quien)).set('X-Local-Id', localId).expect(200)).body,
  );

const nombresEn = (c: Carta) => c.categorias.flatMap((cat) => cat.productos.map((p) => p.nombre));

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
        { id: ids.negocioA, nombreComercial: `Carta A ${sufijo}` },
        { id: ids.negocioB, nombreComercial: `Carta B ${sufijo}` },
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
    // Un producto de B, para comprobar que A no puede usarlo.
    const categoriaB = await tx.categoria.create({
      data: { tenantId: ids.negocioB, nombre: 'Ceviches' },
    });
    await tx.producto.create({
      data: {
        id: ids.productoAjeno,
        tenantId: ids.negocioB,
        categoriaId: categoriaB.id,
        nombre: 'Ceviche ajeno',
        precio: '20.00',
      },
    });
  });
  for (const nombre of ['duena', 'cajera', 'mesera', 'ajena']) await ingresar(nombre);
});

afterAll(async () => {
  await prisma.withoutTenantScope(async (tx) => {
    // Primero los combos: sus platos no se borran en cascada (NO ACTION).
    await tx.comboComponente.deleteMany({
      where: { tenantId: { in: [ids.negocioA, ids.negocioB] } },
    });
    await tx.negocio.deleteMany({ where: { id: { in: [ids.negocioA, ids.negocioB] } } });
    await tx.usuario.deleteMany({ where: { email: { endsWith: `-${sufijo}@demo.test` } } });
  });
  await app.close();
});

describe('categorías', () => {
  it('la dueña las crea en orden y no repite nombres', async () => {
    for (const nombre of ['Ceviches', 'Platos de fondo', 'Combinados', 'Bebidas']) {
      const creada = await api()
        .post('/v1/categorias')
        .set(con('duena'))
        .send({ nombre })
        .expect(201);
      carta[nombre] = categoriaSchema.parse(creada.body).id;
    }
    const repetida = await api()
      .post('/v1/categorias')
      .set(con('duena'))
      .send({ nombre: 'Bebidas' })
      .expect(409);
    expect(repetida.body.error.code).toBe('CATEGORIA_DUPLICADA');

    const lista = await api().get('/v1/categorias').set(con('duena')).expect(200);
    expect(lista.body.map((c: { nombre: string; orden: number }) => [c.nombre, c.orden])).toEqual([
      ['Ceviches', 0],
      ['Platos de fondo', 1],
      ['Combinados', 2],
      ['Bebidas', 3],
    ]);
  });

  it('la cajera y la mesera no administran la carta', async () => {
    await api().post('/v1/categorias').set(con('cajera')).send({ nombre: 'Otra' }).expect(403);
    await api().get('/v1/productos').set(con('mesera')).expect(403);
  });
});

describe('productos y combos', () => {
  it('crea productos con táper y precio en soles', async () => {
    const platos = [
      ['Ceviche de pescado', 'Ceviches', '25.00', '1.00', true],
      ['Chicharrón de pota', 'Platos de fondo', '22.00', '1.00', true],
      ['Coca-Cola personal', 'Bebidas', '4.00', '0.00', false],
    ] as const;
    for (const [nombre, categoria, precio, costo_taper, requiere_cocina] of platos) {
      const creado = await api()
        .post('/v1/productos')
        .set(con('duena'))
        .send({ categoria_id: carta[categoria], nombre, precio, costo_taper, requiere_cocina })
        .expect(201);
      const producto = productoSchema.parse(creado.body);
      expect(producto).toMatchObject({ precio, costo_taper, es_combo: false, componentes: [] });
      carta[nombre] = producto.id;
    }
  });

  it('un combo lleva sus platos fijos (RF-CAR-003)', async () => {
    const creado = await api()
      .post('/v1/productos')
      .set(con('duena'))
      .send({
        categoria_id: carta.Combinados,
        nombre: 'Mixto',
        precio: '32.00',
        costo_taper: '1.00',
        componentes: [
          { producto_id: carta['Ceviche de pescado'], cantidad: 1 },
          { producto_id: carta['Chicharrón de pota'], cantidad: 1 },
        ],
      })
      .expect(201);
    const mixto = productoSchema.parse(creado.body);
    carta.Mixto = mixto.id;
    expect(mixto.es_combo).toBe(true);
    expect(mixto.componentes.map((c) => c.nombre)).toEqual([
      'Ceviche de pescado',
      'Chicharrón de pota',
    ]);
  });

  it('un combo no lleva otro combo, ni a sí mismo, ni platos de otro negocio', async () => {
    const intento = (componentes: { producto_id: string; cantidad: number }[]) =>
      api()
        .post('/v1/productos')
        .set(con('duena'))
        .send({ categoria_id: carta.Combinados, nombre: 'Raro', precio: '50.00', componentes })
        .expect(422);

    expect((await intento([{ producto_id: carta.Mixto!, cantidad: 1 }])).body.error.code).toBe(
      'COMPONENTE_INVALIDO',
    );
    await intento([{ producto_id: ids.productoAjeno, cantidad: 1 }]);
    await api()
      .patch(`/v1/productos/${carta.Mixto}`)
      .set(con('duena'))
      .send({ componentes: [{ producto_id: carta.Mixto, cantidad: 1 }] })
      .expect(422);
    // Un plato que ya está en un combo no puede volverse combo.
    await api()
      .patch(`/v1/productos/${carta['Ceviche de pescado']}`)
      .set(con('duena'))
      .send({ componentes: [{ producto_id: carta['Coca-Cola personal'], cantidad: 1 }] })
      .expect(422);
  });

  it('un nombre repetido responde 409', async () => {
    const repetido = await api()
      .post('/v1/productos')
      .set(con('duena'))
      .send({ categoria_id: carta.Ceviches, nombre: 'Mixto', precio: '10.00' })
      .expect(409);
    expect(repetido.body.error.code).toBe('PRODUCTO_DUPLICADO');
  });

  it('cambiar un precio queda en auditoría con el antes y el después', async () => {
    await api()
      .patch(`/v1/productos/${carta['Ceviche de pescado']}`)
      .set(con('duena'))
      .send({ precio: '26.00' })
      .expect(200);

    const registro = await prisma.withTenant(ids.negocioA, (tx) =>
      tx.auditoria.findFirst({ where: { accion: 'carta.precio_cambiado' } }),
    );
    expect(registro?.datos).toMatchObject({ antes: '25.00', despues: '26.00' });
  });
});

describe('la carta de la caja', () => {
  it('la cajera ve su carta con combos, precios y táper', async () => {
    const vista = await leerCarta('cajera', ids.centro);

    expect(vista.categorias.map((c) => c.nombre)).toEqual([
      'Ceviches',
      'Platos de fondo',
      'Combinados',
      'Bebidas',
    ]);
    const mixto = vista.categorias[2]!.productos[0]!;
    expect(mixto).toMatchObject({
      nombre: 'Mixto',
      precio: '32.00',
      costo_taper: '1.00',
      es_combo: true,
      agotado: false,
      componentes: [
        { nombre: 'Ceviche de pescado', cantidad: 1 },
        { nombre: 'Chicharrón de pota', cantidad: 1 },
      ],
    });
  });

  it('un producto deshabilitado en un local no aparece en la carta de ese local', async () => {
    await api()
      .put(`/v1/productos/${carta['Coca-Cola personal']}/locales/${ids.norte}`)
      .set(con('duena'))
      .send({ habilitado: false, precio_local: null })
      .expect(200);

    expect(nombresEn(await leerCarta('duena', ids.norte))).not.toContain('Coca-Cola personal');
    expect(nombresEn(await leerCarta('duena', ids.centro))).toContain('Coca-Cola personal');
  });

  it('un local puede tener su propio precio (RF-CAR-009)', async () => {
    await api()
      .put(`/v1/productos/${carta.Mixto}/locales/${ids.centro}`)
      .set(con('duena'))
      .send({ habilitado: true, precio_local: '30.00' })
      .expect(200);

    const centro = await leerCarta('cajera', ids.centro);
    const norte = await leerCarta('duena', ids.norte);
    const precioDe = (c: Carta) =>
      c.categorias.flatMap((cat) => cat.productos).find((p) => p.nombre === 'Mixto')?.precio;
    expect(precioDe(centro)).toBe('30.00');
    expect(precioDe(norte)).toBe('32.00');
  });

  it('la cajera marca agotado en su local, y solo en el suyo (RF-CAR-007)', async () => {
    const id = carta['Chicharrón de pota'];
    await api()
      .post(`/v1/productos/${id}/agotado`)
      .set(con('cajera'))
      .set('X-Local-Id', ids.centro)
      .expect(204);
    const agotadoEn = async (localId: string, quien: string) =>
      (await leerCarta(quien, localId)).categorias
        .flatMap((c) => c.productos)
        .find((p) => p.id === id)?.agotado;
    expect(await agotadoEn(ids.centro, 'cajera')).toBe(true);
    expect(await agotadoEn(ids.norte, 'duena')).toBe(false);

    const ajeno = await api()
      .post(`/v1/productos/${id}/agotado`)
      .set(con('cajera'))
      .set('X-Local-Id', ids.norte)
      .expect(403);
    expect(ajeno.body.error.code).toBe('LOCAL_NO_ASIGNADO');

    await api()
      .delete(`/v1/productos/${id}/agotado`)
      .set(con('cajera'))
      .set('X-Local-Id', ids.centro)
      .expect(204);
    expect(await agotadoEn(ids.centro, 'cajera')).toBe(false);
  });

  it('con la misma versión responde 304; tras un cambio, la carta nueva', async () => {
    const primera = await api()
      .get('/v1/carta')
      .set(con('cajera'))
      .set('X-Local-Id', ids.centro)
      .expect(200);
    const etag = primera.headers.etag as string;
    expect(etag).toBe(`"${primera.body.version as string}"`);

    await api()
      .get('/v1/carta')
      .set(con('cajera'))
      .set('X-Local-Id', ids.centro)
      .set('If-None-Match', etag)
      .expect(304);

    await api()
      .patch(`/v1/categorias/${carta.Bebidas}`)
      .set(con('duena'))
      .send({ activa: false })
      .expect(200);
    const nueva = await api()
      .get('/v1/carta')
      .set(con('cajera'))
      .set('X-Local-Id', ids.centro)
      .set('If-None-Match', etag)
      .expect(200);
    expect(nueva.headers.etag).not.toBe(etag);
    // Una categoría desactivada saca sus productos de la caja.
    expect(nueva.body.categorias.map((c: { nombre: string }) => c.nombre)).not.toContain('Bebidas');
  });

  it('el orden por arrastre se ve en la caja', async () => {
    await api()
      .put('/v1/categorias/orden')
      .set(con('duena'))
      .send({ ids: [carta.Combinados, carta.Ceviches, carta['Platos de fondo'], carta.Bebidas] })
      .expect(200);

    const vista = await leerCarta('cajera', ids.centro);
    expect(vista.categorias.map((c) => c.nombre)).toEqual([
      'Combinados',
      'Ceviches',
      'Platos de fondo',
    ]);
  });

  it('la mesera no usa la carta: los pedidos se toman en caja', async () => {
    await api().get('/v1/carta').set(con('mesera')).set('X-Local-Id', ids.centro).expect(403);
  });
});

describe('aislamiento', () => {
  it('otro negocio no ve ni toca la carta de A', async () => {
    const productos = await api().get('/v1/productos').set(con('ajena')).expect(200);
    expect(productos.body.map((p: { nombre: string }) => p.nombre)).toEqual(['Ceviche ajeno']);

    await api()
      .patch(`/v1/productos/${carta.Mixto}`)
      .set(con('ajena'))
      .send({ precio: '1.00' })
      .expect(404);
    await api()
      .put(`/v1/productos/${carta.Mixto}/locales/${ids.sur}`)
      .set(con('ajena'))
      .send({ habilitado: false, precio_local: null })
      .expect(404);
    // Ni siquiera puede ordenar sus categorías con un id de A.
    await api()
      .put('/v1/categorias/orden')
      .set(con('ajena'))
      .send({ ids: [carta.Ceviches] })
      .expect(404);
  });

  it('A no puede poner un producto suyo en un local de B', async () => {
    await api()
      .put(`/v1/productos/${carta.Mixto}/locales/${ids.sur}`)
      .set(con('duena'))
      .send({ habilitado: false, precio_local: null })
      .expect(404);
  });
});
