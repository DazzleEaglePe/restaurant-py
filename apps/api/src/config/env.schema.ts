import { z } from 'zod';

const vacioANulo = (valor: unknown): unknown => (valor === '' ? undefined : valor);

/**
 * Variables de entorno de la API (docs/11_ESTRUCTURA_PROYECTO.md §12.1).
 * Se amplía con cada módulo: base de datos y Redis llegan con el esquema inicial.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4001),
  // Origen de la web: CORS y enlaces de los correos.
  WEB_URL: z.url().default('http://localhost:4000'),
  // Commit de la imagen en ejecución; lo publica `/v1/health`.
  APP_RELEASE: z.preprocess(vacioANulo, z.string().default('dev')),
});

export type Environment = z.infer<typeof envSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const resultado = envSchema.safeParse(config);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Variables de entorno inválidas: ${detalle}`);
  }
  return resultado.data;
}
