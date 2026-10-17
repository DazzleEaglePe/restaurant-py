import { HttpStatus } from '@nestjs/common';

/**
 * Error con código del catálogo de docs/06_API_CONTRACT.md §1.4. El filtro global
 * lo convierte en `{ "error": { code, message, details, request_id } }`.
 */
export class ApiError extends Error {
  constructor(
    readonly status: HttpStatus,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    /** Cabeceras extra de la respuesta, como `Retry-After`. */
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const noAutenticado = (message = 'Inicia sesión para continuar.') =>
  new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', message);
