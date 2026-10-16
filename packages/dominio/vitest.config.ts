import { defineConfig } from 'vitest/config';

// docs/11_ESTRUCTURA_PROYECTO.md §6.2: las reglas de negocio se prueban con
// cobertura ≥ 90 %.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
