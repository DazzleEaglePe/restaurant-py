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
    // Rol resto_plataforma, con BYPASSRLS: solo para /platform/v1 (docs/07 §11).
    DATABASE_PLATFORM_URL: z
      .string()
      .default('postgresql://resto_plataforma:resto_plataforma_dev@localhost:5433/resto'),
    // IPs o subredes (CIDR) desde las que se abre la consola de plataforma,
    // separadas por coma. Vacío: en desarrollo se permite todo; en producción, nada.
    PLATAFORMA_IPS: z.preprocess(
      (valor) =>
        typeof valor === 'string'
          ? valor
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
          : valor,
      z.array(z.string()).default([]),
    ),
    // Proxies cuya cabecera X-Forwarded-For se acepta para conocer la IP real
    // (valor de `trust proxy` de Express: "loopback", una IP o una subred).
    TRUST_PROXY: textoOpcional,
    // 32 bytes en base64 para AES-256-GCM; `generate-keys.sh` la crea.
    ENCRYPTION_KEY: textoOpcional,
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
    if (entorno.NODE_ENV === 'production' && !entorno.ENCRYPTION_KEY) {
      contexto.addIssue({
        code: 'custom',
        path: ['ENCRYPTION_KEY'],
        message: 'ENCRYPTION_KEY es obligatoria en producción.',
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
