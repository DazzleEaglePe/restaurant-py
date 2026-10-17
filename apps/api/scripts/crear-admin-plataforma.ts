/**
 * Crea un administrador de la consola de plataforma (docs/07_SEGURIDAD_AUTH.md §11).
 *
 *   PLATAFORMA_PASSWORD='…' pnpm --filter @resto/api plataforma:crear-admin \
 *     --email persona@tabgroup.pe --nombre "Persona"
 *
 * La contraseña va por variable de entorno para que no quede en el historial de
 * la terminal. Imprime el secreto TOTP y su enlace `otpauth://` para agregarlo
 * a una app de autenticación; no se vuelve a mostrar.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { PrismaClient } from '@prisma/client';

import { Cifrador } from '../src/infrastructure/crypto/cifrado';
import { hashearContrasena } from '../src/infrastructure/crypto/contrasenas';
import { generarSecretoTotp, uriTotp } from '../src/infrastructure/crypto/totp';
import { validarContrasenaNueva } from '../src/modules/auth/politica-contrasenas';

const envRaiz = path.resolve(__dirname, '../../../.env');
if (existsSync(envRaiz)) process.loadEnvFile(envRaiz);

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, nombre: { type: 'string' } },
  });
  const password = process.env.PLATAFORMA_PASSWORD ?? '';
  const clave = process.env.ENCRYPTION_KEY;
  if (!values.email || !values.nombre) throw new Error('Indica --email y --nombre.');
  if (!clave) throw new Error('Falta ENCRYPTION_KEY (./tools/scripts/generate-keys.sh).');
  validarContrasenaNueva(password, values.email);

  const secreto = generarSecretoTotp();
  const prisma = new PrismaClient({
    datasourceUrl:
      process.env.DATABASE_PLATFORM_URL ??
      'postgresql://resto_plataforma:resto_plataforma_dev@localhost:5433/resto',
  });
  try {
    await prisma.administradorPlataforma.create({
      data: {
        email: values.email,
        nombre: values.nombre,
        passwordHash: await hashearContrasena(password),
        totpSecreto: new Cifrador(clave).cifrar(secreto),
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  console.log(`Administrador creado: ${values.email}`);
  console.log('Agrega este secreto a tu app de autenticación (no se vuelve a mostrar):');
  console.log(`  Secreto: ${secreto}`);
  console.log(`  Enlace:  ${uriTotp(secreto, values.email)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
