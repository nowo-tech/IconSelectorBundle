import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for Icon Selector Bundle TypeScript unit tests.
 * Uses happy-dom as the DOM environment and runs all `*.test.ts` files under Resources/assets.
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/Resources/assets/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage-ts',
      // Solo logger.ts para poder exigir 100%; icon-selector-lib tiene ~2000 líneas y tests en icon-selector-lib.test.ts no cuentan para este umbral.
      include: ['src/Resources/assets/src/logger.ts'],
      exclude: ['**/*.test.ts', '**/node_modules/**'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
