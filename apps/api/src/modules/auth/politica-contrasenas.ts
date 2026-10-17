import { HttpStatus } from '@nestjs/common';
import { dictionary } from '@zxcvbn-ts/language-common';

import { LONGITUD_MINIMA_CONTRASENA } from '../../infrastructure/crypto/contrasenas';
import { ApiError } from '../../shared/errors/api-error';

/** docs/07_SEGURIDAD_AUTH.md §2.3: se rechazan las 10 000 más comunes. */
const CANTIDAD_COMUNES = 10_000;

let comunes: ReadonlySet<string> | undefined;

/** Lista ordenada por frecuencia del diccionario de zxcvbn-ts; se carga una vez. */
function contrasenasComunes(): ReadonlySet<string> {
  comunes ??= new Set(
    (dictionary.passwords as string[]).slice(0, CANTIDAD_COMUNES).map((p) => p.toLowerCase()),
  );
  return comunes;
}

const debil = (message: string) =>
  new ApiError(HttpStatus.BAD_REQUEST, 'CONTRASENA_DEBIL', message);

/** Lanza `400 CONTRASENA_DEBIL` si la contraseña no cumple la política. */
export function validarContrasenaNueva(password: string, email?: string): void {
  if (password.length < LONGITUD_MINIMA_CONTRASENA) {
    throw debil(`Usa al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`);
  }
  const normalizada = password.toLowerCase();
  if (contrasenasComunes().has(normalizada)) {
    throw debil('Esa contraseña es de las más usadas. Elige otra.');
  }
  if (email && normalizada === email.toLowerCase()) {
    throw debil('La contraseña no puede ser tu correo.');
  }
}
