import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from './health.js';
import { montoSchema } from './monto.js';

describe('healthResponseSchema', () => {
  it('acepta la respuesta de la API', () => {
    const respuesta = {
      status: 'ok',
      service: 'resto-api',
      release: 'dev',
      timestamp: '2026-10-16T15:00:00.000Z',
    };

    expect(healthResponseSchema.parse(respuesta)).toEqual(respuesta);
  });

  it('rechaza una versión vacía', () => {
    expect(
      healthResponseSchema.safeParse({
        status: 'ok',
        service: 'resto-api',
        release: '',
        timestamp: '2026-10-16T15:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

describe('mensajes de validación', () => {
  it('están en español', async () => {
    await import('../index.js');
    const resultado = montoSchema.safeParse(25);
    expect(resultado.error?.issues[0]?.message).toMatch(/^Entrada inválida/);
  });
});

describe('montoSchema', () => {
  it.each(['0.00', '25.00', '12345678.99'])('acepta %s', (monto) => {
    expect(montoSchema.safeParse(monto).success).toBe(true);
  });

  it.each(['25', '25.5', '25.000', '-1.00', '123456789.00', ' 25.00', 'S/ 25.00'])(
    'rechaza %s',
    (monto) => {
      expect(montoSchema.safeParse(monto).success).toBe(false);
    },
  );
});
