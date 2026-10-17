import { describe, expect, it } from 'vitest';

import { ApiError } from '../../shared/errors/api-error';
import { validarContrasenaNueva } from './politica-contrasenas';

const codigo = (password: string, email?: string) => {
  try {
    validarContrasenaNueva(password, email);
    return 'OK';
  } catch (error) {
    return error instanceof ApiError ? error.code : 'OTRO';
  }
};

describe('validarContrasenaNueva', () => {
  it('acepta una contraseña larga y poco común', () => {
    expect(codigo('ceviche-con-cancha-42')).toBe('OK');
  });

  it('rechaza menos de 10 caracteres', () => {
    expect(codigo('corta-123')).toBe('CONTRASENA_DEBIL');
  });

  it.each(['1234567890', 'qwertyuiop', 'PASSWORD12'])(
    'rechaza %s por estar entre las 10 000 más comunes',
    (password) => {
      expect(codigo(password)).toBe('CONTRASENA_DEBIL');
    },
  );

  it('rechaza usar el propio correo', () => {
    expect(codigo('rosa@correo.pe', 'Rosa@Correo.pe')).toBe('CONTRASENA_DEBIL');
  });
});
