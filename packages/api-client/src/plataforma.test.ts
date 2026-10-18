import { describe, expect, it, vi } from 'vitest';

import { mensajeDeValidacion } from './mensajes.js';
import { ClientePlataforma } from './plataforma.js';
import { ErrorApi } from './respuestas.js';

const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sesion = {
  access_token: 'tp',
  expires_in: 1800,
  admin: { id: 'a', nombre: 'Equipo', email: 'equipo@resto.test' },
};

function clienteCon(responder: (ruta: string) => Response) {
  const llamadas: Array<{ ruta: string; init: RequestInit }> = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const ruta = String(url).replace('http://api.test', '');
    llamadas.push({ ruta, init: init ?? {} });
    return responder(ruta);
  }) as unknown as typeof globalThis.fetch;
  const alExpirarSesion = vi.fn();
  return {
    cliente: new ClientePlataforma({ baseUrl: 'http://api.test', fetch, alExpirarSesion }),
    llamadas,
    alExpirarSesion,
  };
}

describe('ClientePlataforma', () => {
  it('manda el token de plataforma y nunca las cookies del navegador', async () => {
    const { cliente, llamadas } = clienteCon((ruta) =>
      ruta === '/platform/v1/auth/login' ? json(200, sesion) : json(200, []),
    );

    await cliente.ingresar({ email: 'equipo@resto.test', password: 'clave', totp: '123456' });
    await cliente.negocios.listar();

    expect(llamadas[0]!.init.credentials).toBe('omit');
    const cabeceras = llamadas[1]!.init.headers as Record<string, string>;
    expect(cabeceras.Authorization).toBe('Bearer tp');
    expect(llamadas[1]!.init.credentials).toBe('omit');
  });

  it('con el token vencido avisa y lo olvida, sin intentar renovarlo', async () => {
    const { cliente, llamadas, alExpirarSesion } = clienteCon((ruta) =>
      ruta === '/platform/v1/auth/login'
        ? json(200, sesion)
        : json(401, { error: { code: 'UNAUTHENTICATED', message: 'Ingresa de nuevo.' } }),
    );

    await cliente.ingresar({ email: 'equipo@resto.test', password: 'clave', totp: '123456' });
    await expect(cliente.negocios.suspender('n1')).rejects.toBeInstanceOf(ErrorApi);

    expect(alExpirarSesion).toHaveBeenCalledOnce();
    expect(cliente.tieneSesion).toBe(false);
    expect(llamadas).toHaveLength(2);
  });

  it('un ingreso fallido no cuenta como sesión vencida', async () => {
    const { cliente, alExpirarSesion } = clienteCon(() =>
      json(401, {
        error: { code: 'UNAUTHENTICATED', message: 'Correo, contraseña o código incorrectos.' },
      }),
    );

    await expect(
      cliente.ingresar({ email: 'equipo@resto.test', password: 'mal', totp: '000000' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(alExpirarSesion).not.toHaveBeenCalled();
  });

  it('suspender responde sin cuerpo', async () => {
    const { cliente, llamadas } = clienteCon(() => new Response(null, { status: 204 }));

    await expect(cliente.negocios.suspender('n1')).resolves.toBeUndefined();
    expect(llamadas[0]).toMatchObject({
      ruta: '/platform/v1/negocios/n1/suspender',
      init: { method: 'POST' },
    });
  });
});

describe('mensajeDeValidacion', () => {
  it('nombra cada campo con su etiqueta, también los anidados', () => {
    const error = new ErrorApi(400, 'VALIDATION_ERROR', 'Revisa los datos marcados.', {
      campos: [
        { campo: 'owner.email', mensaje: 'Correo inválido.' },
        {
          campo: 'local_inicial',
          mensaje: 'Demasiado pequeño: se esperaba que texto tuviera >=2 caracteres',
        },
      ],
    });

    expect(
      mensajeDeValidacion(error, {
        'owner.email': 'Correo del dueño',
        local_inicial: 'Primer local',
      }),
    ).toBe(
      'Revisa los datos. Correo del dueño: Correo inválido. Primer local: debe tener al menos 2 caracteres.',
    );
  });

  it.each([
    [
      'Demasiado pequeño: se esperaba que texto tuviera >=2 caracteres',
      'debe tener al menos 2 caracteres',
    ],
    [
      'Demasiado grande: se esperaba que texto tuviera <=80 caracteres',
      'debe tener como máximo 80 caracteres',
    ],
    [
      'Demasiado pequeño: se esperaba que arreglo tuviera >=1 elementos',
      'debe tener al menos 1 elemento',
    ],
    ['Demasiado grande: se esperaba que número fuera <=60', 'debe ser como máximo 60'],
    ['Inválido dirección de correo electrónico', 'no es un correo válido'],
    ['Inválido UUID', 'no tiene un formato válido'],
  ])('«%s» → «%s»', (original, natural) => {
    const error = new ErrorApi(400, 'VALIDATION_ERROR', 'Revisa los datos marcados.', {
      campos: [{ campo: 'x', mensaje: original }],
    });
    expect(mensajeDeValidacion(error, { x: 'Dato' })).toBe(`Revisa los datos. Dato: ${natural}.`);
  });

  it('sin campos usa el mensaje de la API', () => {
    const error = new ErrorApi(400, 'VALIDATION_ERROR', 'Revisa los datos marcados.');
    expect(mensajeDeValidacion(error, {})).toBe('Revisa los datos marcados.');
  });
});
