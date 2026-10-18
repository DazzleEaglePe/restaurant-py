import { ErrorApi, mensajeDeValidacion } from '@resto/api-client';

/** Nombre de cada campo de la API como aparece en los formularios de la consola. */
const ETIQUETAS: Record<string, string> = {
  email: 'Correo',
  password: 'Contraseña',
  totp: 'Código',
  nombre_comercial: 'Nombre comercial',
  local_inicial: 'Primer local',
  'owner.nombre': 'Nombre del dueño',
  'owner.email': 'Correo del dueño',
};

/** Mensaje para el equipo: qué pasó y qué hacer (docs/09_DESIGN_SYSTEM.md §16). */
export function mensajeDeError(error: unknown): string {
  if (!(error instanceof ErrorApi)) {
    return 'No pudimos conectar con la API. Revisa tu conexión a la VPN e intenta de nuevo.';
  }
  if (error.status === 403) {
    return `${error.message} Conéctate a la VPN del equipo e intenta de nuevo.`;
  }
  switch (error.code) {
    case 'RATE_LIMIT_EXCEEDED':
      return 'Hiciste muchos intentos seguidos. Espera un minuto e intenta de nuevo.';
    case 'VALIDATION_ERROR':
      return mensajeDeValidacion(error, ETIQUETAS);
    default:
      return error.message;
  }
}
