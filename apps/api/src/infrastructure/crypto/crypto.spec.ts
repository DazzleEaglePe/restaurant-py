import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { Cifrador } from './cifrado';
import {
  codificarBase32,
  codigoTotp,
  decodificarBase32,
  generarSecretoTotp,
  verificarTotp,
} from './totp';

describe('TOTP (RFC 6238)', () => {
  // Vectores de prueba del apéndice B de RFC 6238, con SHA-1 y 8 dígitos.
  const secretoRfc = Buffer.from('12345678901234567890', 'ascii');
  it.each([
    [59, '94287082'],
    [1_111_111_109, '07081804'],
    [1_111_111_111, '14050471'],
    [1_234_567_890, '89005924'],
    [2_000_000_000, '69279037'],
    [20_000_000_000, '65353130'],
  ])('a los %i s da %s', (segundos, esperado) => {
    expect(codigoTotp(secretoRfc, segundos * 1000, 8)).toBe(esperado);
  });

  it('acepta el paso actual y los vecinos, y nada más', () => {
    const secreto = generarSecretoTotp();
    const ahora = 1_760_000_000_000;
    const codigo = (desfase: number) => codigoTotp(decodificarBase32(secreto), ahora + desfase);

    expect(verificarTotp(secreto, codigo(0), ahora)).toBe(true);
    expect(verificarTotp(secreto, codigo(-30_000), ahora)).toBe(true);
    expect(verificarTotp(secreto, codigo(30_000), ahora)).toBe(true);
    expect(verificarTotp(secreto, codigo(90_000), ahora)).toBe(false);
    expect(verificarTotp(secreto, 'abc123', ahora)).toBe(false);
  });

  it('base32 ida y vuelta', () => {
    const datos = randomBytes(20);
    expect(decodificarBase32(codificarBase32(datos))).toEqual(datos);
    expect(codificarBase32(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });
});

describe('Cifrador (AES-256-GCM)', () => {
  const clave = randomBytes(32).toString('base64');

  it('cifra y descifra', () => {
    const cifrador = new Cifrador(clave);
    const cifrado = cifrador.cifrar('JBSWY3DPEHPK3PXP');

    expect(Buffer.from(cifrado).toString('utf8')).not.toContain('JBSWY3DPEHPK3PXP');
    expect(cifrador.descifrar(cifrado)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('cada cifrado usa un iv distinto', () => {
    const cifrador = new Cifrador(clave);
    expect(cifrador.cifrar('x')).not.toEqual(cifrador.cifrar('x'));
  });

  it('detecta un dato alterado o una clave distinta', () => {
    const cifrado = new Cifrador(clave).cifrar('secreto');
    const alterado = Buffer.from(cifrado);
    alterado[alterado.length - 1]! ^= 1;

    expect(() => new Cifrador(clave).descifrar(alterado)).toThrow();
    expect(() => new Cifrador(randomBytes(32).toString('base64')).descifrar(cifrado)).toThrow();
  });

  it('exige una clave de 32 bytes', () => {
    expect(() => new Cifrador(randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
  });
});
