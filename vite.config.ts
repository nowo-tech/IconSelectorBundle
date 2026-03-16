import { defineConfig } from 'vite';

/**
 * Vite configuration for the Icon Selector Bundle frontend assets.
 * Builds TypeScript to a single IIFE in `src/Resources/public` for Symfony `assets:install`
 * (output ends up at `public/bundles/nowoiconselector/icon-selector.js`).
 * Stimulus controller source is in Resources/assets/controllers/ for apps that use Stimulus (UX component pattern).
 */
export default defineConfig({
  define: {
    __ICON_SELECTOR_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    outDir: 'src/Resources/public',
    emptyOutDir: false,
    rollupOptions: {
      input: 'src/Resources/assets/src/icon-selector.ts',
      output: {
        format: 'iife',
        entryFileNames: 'icon-selector.js',
        assetFileNames: 'icon-selector.[ext]',
      },
    },
    minify: true,
    sourcemap: false,
  },
});
