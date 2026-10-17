import { createHash, randomBytes } from 'node:crypto';

/** Token aleatorio de 256 bits para cookies y enlaces de un solo uso. */
export function generarTokenOpaco(): string {
  return randomBytes(32).toString('base64url');
}

/** Solo el hash se guarda en la base (`char(64)`): una filtración no da sesiones. */
export function hashearTokenOpaco(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
