import { describe, expect, it } from 'vitest';

import { hashearContrasena, verificarContrasena } from './contrasenas';

describe('contraseñas', () => {
  it('usa Argon2id con los parámetros de docs/07 §2.3', async () => {
    const hash = await hashearContrasena('una-clave-larga');
    // Formato PHC: $argon2id$v=19$m=…,t=…,p=…$sal$hash (el orden de m, t y p varía).
    const [, algoritmo, , parametros] = hash.split('$');

    expect(algoritmo).toBe('argon2id');
    expect(Object.fromEntries((parametros ?? '').split(',').map((p) => p.split('=')))).toEqual({
      m: '65536',
      t: '3',
      p: '4',
    });
  });

  it('verifica la contraseña correcta y rechaza otra', async () => {
    const hash = await hashearContrasena('una-clave-larga');

    await expect(verificarContrasena(hash, 'una-clave-larga')).resolves.toBe(true);
    await expect(verificarContrasena(hash, 'otra-clave-larga')).resolves.toBe(false);
  });
});
