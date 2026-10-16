import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'prisma/config';

// Prisma deja de leer `.env` automáticamente cuando existe este archivo de
// configuración, así que se carga el archivo de la raíz del monorepo a mano.
const rootEnvFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (!process.env.DATABASE_URL && existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

// La CLI de Prisma (migraciones, semilla, studio) necesita el rol propietario:
// el rol de la aplicación no puede alterar el esquema ni omitir Row Level Security.
if (process.env.DIRECT_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL;
}

export default defineConfig({
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  schema: 'prisma/schema.prisma',
});
