import { ErrorApi } from '@resto/api-client';
import { describe, expect, it } from 'vitest';

import { mensajeDeError } from './errores';

describe('mensajeDeError', () => {
  it('fuera de la red permitida pide conectarse a la VPN', () => {
    const error = new ErrorApi(403, 'FORBIDDEN', 'La consola no se abre desde esta red.');
    expect(mensajeDeError(error)).toBe(
      'La consola no se abre desde esta red. Conéctate a la VPN del equipo e intenta de nuevo.',
    );
  });

  it('nombra los campos del alta como en el formulario', () => {
    const error = new ErrorApi(400, 'VALIDATION_ERROR', 'Revisa los datos marcados.', {
      campos: [{ campo: 'owner.email', mensaje: 'Correo electrónico inválido.' }],
    });
    expect(mensajeDeError(error)).toBe(
      'Revisa los datos. Correo del dueño: Correo electrónico inválido.',
    );
  });

  it('sin respuesta de la API habla de la conexión', () => {
    expect(mensajeDeError(new TypeError('Failed to fetch'))).toMatch(/^No pudimos conectar/);
  });

  it('el ingreso fallido usa el mensaje de la API, que no dice qué dato falló', () => {
    const error = new ErrorApi(401, 'UNAUTHENTICATED', 'Correo, contraseña o código incorrectos.');
    expect(mensajeDeError(error)).toBe('Correo, contraseña o código incorrectos.');
  });
});
