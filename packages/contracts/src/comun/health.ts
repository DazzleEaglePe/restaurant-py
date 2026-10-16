import { z } from 'zod';

/** `GET /v1/health`: el proceso responde (docs/06_API_CONTRACT.md §1). */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('resto-api'),
  release: z.string().min(1),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

const estadoDependenciaSchema = z.enum(['up', 'down']);

/** `GET /v1/health/ready`: `200` si las dependencias responden, `503` si no. */
export const readinessResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  checks: z.object({
    database: estadoDependenciaSchema,
  }),
});

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
