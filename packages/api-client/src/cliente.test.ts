import { describe, expect, it, vi } from 'vitest';

import { ClienteApi } from './cliente.js';
import { ErrorApi } from './respuestas.js';

const sesion = (token: string) => ({
  access_token: token,
  expires_in: 900,
  user: { id: 'u', nombre: 'Rosa', email: 'rosa@demo.test' },
  tenant: { id: 't', nombre_comercial: 'Demo' },
  rol: 'CAJERO',
  locales: [],
});

const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const errorApi = (status: number, code: string) =>
  json(status, { error: { code, message: `mensaje ${code}`, request_id: 'req-1' } });

/** Cliente con un servidor falso que responde según la ruta. */
function clienteCon(responder: (ruta: string, init: RequestInit) => Response) {
  const llamadas: Array<{ ruta: string; init: RequestInit }> = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const ruta = String(url).replace('http://api.test', '');
    llamadas.push({ ruta, init: init ?? {} });
    return responder(ruta, init ?? {});
  }) as unknown as typeof globalThis.fetch;
  const alExpirarSesion = vi.fn();
  return {
    cliente: new ClienteApi({ baseUrl: 'http://api.test', fetch, alExpirarSesion }),
    llamadas,
    alExpirarSesion,
  };
}

describe('ClienteApi', () => {
  it('guarda el token del ingreso y lo manda con credenciales y X-Local-Id', async () => {
    const { cliente, llamadas } = clienteCon((ruta) =>
      ruta === '/v1/auth/login' ? json(200, sesion('t1')) : json(200, { nombre: 'Centro' }),
    );

    await cliente.ingresar('rosa@demo.test', 'clave');
    await cliente.locales.actual('local-1');

    const cabeceras = llamadas[1]!.init.headers as Record<string, string>;
    expect(cabeceras.Authorization).toBe('Bearer t1');
    expect(cabeceras['X-Local-Id']).toBe('local-1');
    expect(llamadas[1]!.init.credentials).toBe('include');
  });

  it('ante un 401 renueva una sola vez y repite las solicitudes', async () => {
    let renovaciones = 0;
    const { cliente } = clienteCon((ruta, init) => {
      if (ruta === '/v1/auth/login') return json(200, sesion('viejo'));
      if (ruta === '/v1/auth/refresh') {
        renovaciones += 1;
        return json(200, sesion('nuevo'));
      }
      const autorizacion = (init.headers as Record<string, string>).Authorization;
      return autorizacion === 'Bearer nuevo' ? json(200, []) : errorApi(401, 'UNAUTHENTICATED');
    });
    await cliente.ingresar('rosa@demo.test', 'clave');

    await Promise.all([cliente.locales.listar(), cliente.usuarios.listar(), cliente.yo()]);

    expect(renovaciones).toBe(1);
  });

  it('si la renovación falla, avisa que la sesión venció', async () => {
    const { cliente, alExpirarSesion } = clienteCon((ruta) =>
      ruta === '/v1/auth/login' ? json(200, sesion('t1')) : errorApi(401, 'UNAUTHENTICATED'),
    );
    await cliente.ingresar('rosa@demo.test', 'clave');

    await expect(cliente.yo()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(alExpirarSesion).toHaveBeenCalledOnce();
    expect(cliente.tieneSesion).toBe(false);
  });

  it('un 401 en el ingreso no intenta renovar', async () => {
    const { cliente, llamadas } = clienteCon(() => errorApi(401, 'UNAUTHENTICATED'));

    await expect(cliente.ingresar('x@demo.test', 'mala')).rejects.toBeInstanceOf(ErrorApi);
    expect(llamadas.map((l) => l.ruta)).toEqual(['/v1/auth/login']);
  });

  it('convierte el cuerpo de error en ErrorApi con su código', async () => {
    const { cliente } = clienteCon(() => errorApi(429, 'CUENTA_BLOQUEADA'));

    await expect(cliente.ingresar('x@demo.test', 'mala')).rejects.toMatchObject({
      status: 429,
      code: 'CUENTA_BLOQUEADA',
      requestId: 'req-1',
    });
  });

  it('sin cuerpo de error, pide revisar el internet', async () => {
    const { cliente } = clienteCon(() => new Response('Bad gateway', { status: 502 }));

    await expect(cliente.olvideContrasena('x@demo.test')).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      message: expect.stringMatching(/internet/),
    });
  });

  it('renovar sin cookie devuelve null', async () => {
    const { cliente } = clienteCon(() => errorApi(401, 'UNAUTHENTICATED'));

    await expect(cliente.renovar()).resolves.toBeNull();
  });
});
