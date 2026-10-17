import { z } from 'zod';

const vacioANulo = (valor: unknown): unknown => (valor === '' ? undefined : valor);
const textoOpcional = z.preprocess(vacioANulo, z.string().optional());

/**
 * Variables de entorno de la API (docs/11_ESTRUCTURA_PROYECTO.md §12.1).
 * Se amplía con cada módulo que necesita configuración.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4001),
    // Origen de la web: CORS y enlaces de los correos.
    WEB_URL: z.url().default('http://localhost:4000'),
    // Rol resto_app, sujeto a RLS. Las migraciones usan DIRECT_DATABASE_URL
    // (prisma.config.ts).
    DATABASE_URL: z.string().default('postgresql://resto_app:resto_app_dev@localhost:5433/resto'),
    // Correo: Mailpit en local (buzón en http://localhost:8026).
    SMTP_URL: z.string().default('smtp://localhost:1026'),
    MAIL_FROM: z.string().default('resto <no-responder@resto.test>'),
    // Par RSA de los access tokens (RS256), en PEM; `generate-keys.sh` los crea.
    JWT_PRIVATE_KEY: textoOpcional,
    JWT_PUBLIC_KEY: textoOpcional,
    // Commit de la imagen en ejecución; lo publica `/v1/health`.
    APP_RELEASE: z.preprocess(vacioANulo, z.string().default('dev')),
  })
  .superRefine((entorno, contexto) => {
    // En desarrollo y pruebas, sin claves se generan unas temporales; en
    // producción eso cerraría todas las sesiones en cada despliegue.
    if (
      entorno.NODE_ENV === 'production' &&
      (!entorno.JWT_PRIVATE_KEY || !entorno.JWT_PUBLIC_KEY)
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['JWT_PRIVATE_KEY'],
        message: 'JWT_PRIVATE_KEY y JWT_PUBLIC_KEY son obligatorias en producción.',
      });
    }
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
