/**
 * Lo que la persona escribe en un campo de soles, al formato de la API:
 * «12», «12.5» o «12,50» → «12.50». Vacío → `null`; algo que no es un monto
 * válido (negativo, letras, más de dos decimales) → `undefined`.
 */
export function aMonto(valor: string): string | null | undefined {
  const limpio = valor.trim().replace(',', '.');
  if (limpio === '') return null;
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(limpio)) return undefined;
  return Number(limpio).toFixed(2);
}

/** «32.00» → «S/ 32.00». */
export const soles = (monto: string) => `S/ ${monto}`;
