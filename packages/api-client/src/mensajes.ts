import type { ErrorApi } from './respuestas.js';

const SINGULAR: Record<string, string> = { caracteres: 'carácter', elementos: 'elemento' };

/** «2 caracteres», «1 carácter». */
const cantidad = (numero: string, unidad: string) =>
  `${numero} ${numero === '1' ? (SINGULAR[unidad] ?? unidad) : unidad}`;

/** Vuelve más naturales los mensajes de zod en español (`z.locales.es`). */
const humanizar = (mensaje: string) =>
  mensaje
    .replace(
      /^Demasiado grande: se esperaba que .+ tuviera <=?\s?(\S+) (.+)$/,
      (_, n, u) => `debe tener como máximo ${cantidad(n, u)}`,
    )
    .replace(
      /^Demasiado pequeño: se esperaba que .+ tuviera >=?\s?(\S+) (.+)$/,
      (_, n, u) => `debe tener al menos ${cantidad(n, u)}`,
    )
    .replace(/^Demasiado grande: se esperaba que .+ fuera <=?\s?(\S+)$/, 'debe ser como máximo $1')
    .replace(/^Demasiado pequeño: se esperaba que .+ fuera >=?\s?(\S+)$/, 'debe ser al menos $1')
    .replace(/^Inválido dirección de correo electrónico$/, 'no es un correo válido')
    .replace(/^Inválido .+$/, 'no tiene un formato válido');

/**
 * «Revisa los datos. Ventana de pagos: debe ser como máximo 60.» a partir de un
 * `VALIDATION_ERROR` (docs/09_DESIGN_SYSTEM.md §16). `etiquetas` traduce cada
 * campo de la API al nombre que ve la persona en el formulario.
 */
export function mensajeDeValidacion(error: ErrorApi, etiquetas: Record<string, string>): string {
  const campos = error.details?.campos;
  if (!Array.isArray(campos) || campos.length === 0) return error.message;
  const detalle = campos
    .map((c: { campo?: string; mensaje?: string }) => {
      const etiqueta = etiquetas[c.campo ?? ''] ?? c.campo ?? 'Dato';
      return `${etiqueta}: ${humanizar(c.mensaje ?? 'no es válido').replace(/\.$/, '')}`;
    })
    .join('. ');
  return `Revisa los datos. ${detalle}.`;
}
