/**
 * Aritmética de soles sin coma flotante (docs/11_ESTRUCTURA_PROYECTO.md §6.2).
 *
 * Todo cálculo se hace en céntimos enteros: S/ 25.50 son 2550. La API recibe y
 * devuelve montos como cadena con dos decimales (`"25.50"`) y la base los guarda
 * en `numeric(10,2)`; la conversión ocurre solo en los bordes.
 */

/** `numeric(10,2)`: hasta 8 dígitos enteros. */
const MAXIMO_CENTIMOS = 9_999_999_999;
const PATRON_MONTO = /^(-)?(\d{1,8})(?:\.(\d{1,2}))?$/;

export class MontoInvalidoError extends Error {
  constructor(valor: unknown) {
    super(`Monto inválido: ${String(valor)}`);
    this.name = 'MontoInvalidoError';
  }
}

function asegurarCentimos(centimos: number): number {
  if (!Number.isSafeInteger(centimos) || Math.abs(centimos) > MAXIMO_CENTIMOS) {
    throw new MontoInvalidoError(centimos);
  }
  return centimos;
}

/** `"25.5"` o `"25.50"` → 2550. Acepta un signo negativo para diferencias. */
export function aCentimos(monto: string): number {
  const coincidencia = PATRON_MONTO.exec(monto);
  if (!coincidencia) throw new MontoInvalidoError(monto);

  const [, signo, enteros = '0', decimales = ''] = coincidencia;
  const centimos = Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
  return signo && centimos !== 0 ? -centimos : centimos;
}

/** 2550 → `"25.50"`, el formato de la API. */
export function aMonto(centimos: number): string {
  asegurarCentimos(centimos);
  const absoluto = Math.abs(centimos);
  const texto = `${Math.trunc(absoluto / 100)}.${String(absoluto % 100).padStart(2, '0')}`;
  return centimos < 0 ? `-${texto}` : texto;
}

/** 125000 → `"S/ 1,250.00"`, como se muestra en caja y reportes. */
export function formatearSoles(centimos: number): string {
  const [enteros = '0', decimales = '00'] = aMonto(Math.abs(centimos)).split('.');
  const conMiles = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${centimos < 0 ? '-' : ''}S/ ${conMiles}.${decimales}`;
}

export function sumarCentimos(montos: readonly number[]): number {
  return asegurarCentimos(montos.reduce((total, monto) => total + asegurarCentimos(monto), 0));
}

/** Precio por cantidad de un ítem. La cantidad es un entero no negativo. */
export function multiplicarCentimos(centimos: number, cantidad: number): number {
  if (!Number.isSafeInteger(cantidad) || cantidad < 0) {
    throw new RangeError(`Cantidad inválida: ${cantidad}`);
  }
  return asegurarCentimos(asegurarCentimos(centimos) * cantidad);
}

/** Vuelto de un pago en efectivo, o `null` si lo recibido no cubre el total. */
export function calcularVuelto(totalCentimos: number, recibidoCentimos: number): number | null {
  const diferencia = asegurarCentimos(recibidoCentimos) - asegurarCentimos(totalCentimos);
  return diferencia >= 0 ? diferencia : null;
}
