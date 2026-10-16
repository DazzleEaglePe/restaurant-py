import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    // La suite de aislamiento necesita PostgreSQL con migraciones aplicadas:
    // corre aparte con `pnpm test:aislamiento` (vitest.aislamiento.config.ts).
    exclude: [...configDefaults.exclude, 'test/aislamiento/**'],
  },
});
