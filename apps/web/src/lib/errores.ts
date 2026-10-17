import { ErrorApi } from '@resto/api-client';

/**
 * Mensaje para la persona: qué pasó y qué hacer (docs/09_DESIGN_SYSTEM.md §16).
 * La API ya responde en español; aquí se ajustan los casos que necesitan contexto.
 */
export function mensajeDeError(error: unknown): string {
  if (!(error instanceof ErrorApi)) {
    return 'No pudimos conectar con el servidor. Revisa tu internet e intenta de nuevo.';
  }
  switch (error.code) {
    case 'CUENTA_BLOQUEADA': {
      const segundos = Number(error.details?.reintentar_en_s ?? 900);
      const minutos = Math.max(1, Math.ceil(segundos / 60));
      return `Tu cuenta quedó bloqueada por varios intentos fallidos. Intenta de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} o recupera tu contraseña.`;
    }
    case 'RATE_LIMIT_EXCEEDED':
      return 'Hiciste muchos intentos seguidos. Espera un minuto e intenta de nuevo.';
    case 'ENLACE_INVALIDO':
      return 'Este enlace venció o ya se usó. Pide uno nuevo.';
    default:
      return error.message;
  }
}
