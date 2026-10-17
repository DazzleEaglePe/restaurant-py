import { z } from 'zod';

/** Formato de error de toda la API (docs/06_API_CONTRACT.md §1.3). */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    request_id: z.string(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
