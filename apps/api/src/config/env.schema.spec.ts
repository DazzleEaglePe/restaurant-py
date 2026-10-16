import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './env.schema';

describe('validateEnvironment', () => {
  it('aplica los valores por defecto del entorno local', () => {
    expect(validateEnvironment({})).toEqual({
      NODE_ENV: 'development',
      PORT: 4001,
      WEB_URL: 'http://localhost:4000',
      DATABASE_URL: 'postgresql://resto_app:resto_app_dev@localhost:5433/resto',
      APP_RELEASE: 'dev',
    });
  });

  it('convierte el puerto y trata una versión vacía como ausente', () => {
    const entorno = validateEnvironment({ PORT: '5001', APP_RELEASE: '' });

    expect(entorno.PORT).toBe(5001);
    expect(entorno.APP_RELEASE).toBe('dev');
  });

  it('explica qué variable es inválida', () => {
    expect(() => validateEnvironment({ WEB_URL: 'no-es-url' })).toThrow(/WEB_URL/);
  });
});
