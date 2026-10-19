import { ErrorApi, mensajeDeValidacion } from '@resto/api-client';

/** Nombre de cada campo de la API como aparece en los formularios. */
const ETIQUETAS: Record<string, string> = {
  nombre: 'Nombre',
  direccion: 'Dirección',
  email: 'Correo',
  password: 'Contraseña',
  rol: 'Rol',
  local_ids: 'Locales',
  nombre_comercial: 'Nombre comercial',
  razon_social: 'Razón social',
  ruc: 'RUC',
  color_acento: 'Color de acento',
  ventana_pagos_min: 'Ventana de pagos',
  monto_max_constancia: 'Monto máximo con constancia',
  cocina_alerta_min: 'Alerta de demora',
  cocina_critico_min: 'Demora crítica',
  ocultar_listos_min: 'Ocultar listos',
  tiempo_base_min: 'Espera sugerida',
  costo_taper_defecto: 'Costo del táper',
  categoria_id: 'Categoría',
  descripcion: 'Descripción',
  precio: 'Precio',
  costo_taper: 'Táper',
  foto_url: 'Foto',
  requiere_cocina: 'Pasa por cocina',
  componentes: 'Platos del combo',
  precio_local: 'Precio en el local',
  piso: 'Piso',
};

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
    case 'VALIDATION_ERROR':
      return mensajeDeValidacion(error, ETIQUETAS);
    default:
      return error.message;
  }
}
