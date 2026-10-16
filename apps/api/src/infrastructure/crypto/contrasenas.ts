import argon2 from 'argon2';

/** docs/07_SEGURIDAD_AUTH.md §2.3: Argon2id, 64 MB, 3 iteraciones, paralelismo 4. */
const OPCIONES_ARGON2 = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 4,
} as const;

export const LONGITUD_MINIMA_CONTRASENA = 10;

export function hashearContrasena(contrasena: string): Promise<string> {
  return argon2.hash(contrasena, OPCIONES_ARGON2);
}

export function verificarContrasena(hash: string, contrasena: string): Promise<boolean> {
  return argon2.verify(hash, contrasena);
}
