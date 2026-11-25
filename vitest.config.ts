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
      // logger.ts + svg-sanitizer.ts + icon-selector-boot.ts + floating-panel.ts at 100%; icon-selector-lib (~2,000 lines) has its own tests in icon-selector-lib.test.ts, which do not count towards this threshold.
      include: [
        'src/Resources/assets/src/logger.ts',
        'src/Resources/assets/src/svg-sanitizer.ts',
        'src/Resources/assets/src/icon-selector-boot.ts',
        'src/Resources/assets/src/floating-panel.ts',
      ],
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
