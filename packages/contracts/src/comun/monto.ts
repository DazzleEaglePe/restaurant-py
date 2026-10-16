import { z } from 'zod';

/**
 * Monto en soles como cadena con dos decimales: `"25.00"`
 * (docs/06_API_CONTRACT.md §1). Cabe en `numeric(10,2)`.
 */
export const montoSchema = z
  .string()
  .regex(/^\d{1,8}\.\d{2}$/, 'El monto debe tener dos decimales, por ejemplo "25.00".');

export type Monto = z.infer<typeof montoSchema>;
