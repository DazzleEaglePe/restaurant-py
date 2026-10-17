import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    // Lo que necesita PostgreSQL con migraciones aplicadas corre aparte con
    // `pnpm test:db` (vitest.db.config.ts).
    exclude: [...configDefaults.exclude, 'test/aislamiento/**', 'test/e2e/**'],
  },
});
