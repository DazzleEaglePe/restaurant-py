import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// La suite de aislamiento corre contra PostgreSQL real (docker compose en local,
// servicio en la CI) con el rol de la aplicación, que está sujeto a RLS.
const envRaiz = fileURLToPath(new URL('../../.env', import.meta.url));
if (!process.env.DATABASE_URL && existsSync(envRaiz)) {
  process.loadEnvFile(envRaiz);
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/aislamiento/**/*.e2e-spec.ts'],
    // Las pruebas comparten la base: una a la vez.
    fileParallelism: false,
  },
});
