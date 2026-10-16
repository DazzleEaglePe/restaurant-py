import { z } from 'zod';

/** `GET /v1/health`: el proceso responde (docs/06_API_CONTRACT.md §1). */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('resto-api'),
  release: z.string().min(1),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
