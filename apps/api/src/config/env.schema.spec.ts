import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './env.schema';

describe('validateEnvironment', () => {
  it('aplica los valores por defecto del entorno local', () => {
    expect(validateEnvironment({})).toEqual({
      NODE_ENV: 'development',
      PORT: 4001,
      WEB_URL: 'http://localhost:4000',
      DATABASE_URL: 'postgresql://resto_app:resto_app_dev@localhost:5433/resto',
      DATABASE_PLATFORM_URL:
        'postgresql://resto_plataforma:resto_plataforma_dev@localhost:5433/resto',
      PLATAFORMA_IPS: [],
      SMTP_URL: 'smtp://localhost:1026',
      MAIL_FROM: 'resto <no-responder@resto.test>',
      APP_RELEASE: 'dev',
    });
  });

  it('convierte el puerto y trata una versión vacía como ausente', () => {
    const entorno = validateEnvironment({ PORT: '5001', APP_RELEASE: '' });

    expect(entorno.PORT).toBe(5001);
    expect(entorno.APP_RELEASE).toBe('dev');
  });

  it('en producción exige las claves JWT', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(/JWT_PRIVATE_KEY/);
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        JWT_PRIVATE_KEY: 'a',
        JWT_PUBLIC_KEY: 'b',
        ENCRYPTION_KEY: 'c',
      }),
    ).not.toThrow();
  });

  it('lee PLATAFORMA_IPS separadas por coma', () => {
    expect(
      validateEnvironment({ PLATAFORMA_IPS: '10.8.0.0/24, 190.12.3.4' }).PLATAFORMA_IPS,
    ).toEqual(['10.8.0.0/24', '190.12.3.4']);
  });

  it('explica qué variable es inválida', () => {
    expect(() => validateEnvironment({ WEB_URL: 'no-es-url' })).toThrow(/WEB_URL/);
  });
});
