import type { ErrorResponse } from '@resto/contracts';

/** Error de la API con su código del catálogo (docs/06_API_CONTRACT.md §1.4). */
export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ErrorApi';
  }
}

/** El cuerpo de una respuesta correcta, o el `ErrorApi` de una fallida. */
export async function interpretarRespuesta<T>(respuesta: Response): Promise<T> {
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
  if (respuesta.status === 204 || respuesta.status === 202) return undefined as T;
  return (await respuesta.json()) as T;
}

export async function errorDeRespuesta(respuesta: Response): Promise<ErrorApi> {
  try {
    const { error } = (await respuesta.clone().json()) as ErrorResponse;
    return new ErrorApi(
      respuesta.status,
      error.code,
      error.message,
      error.details,
      error.request_id,
    );
  } catch {
    return new ErrorApi(
      respuesta.status,
      'HTTP_ERROR',
      'No pudimos conectar con el servidor. Revisa tu internet.',
    );
  }
}
