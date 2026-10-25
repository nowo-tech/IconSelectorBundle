import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { defineConfig } from 'vite';

/**
 * Deterministic build id: a hash of the TypeScript/CSS sources and pnpm-lock.yaml. It only changes when the code or
 * the dependencies change, so rebuilding unchanged sources (e.g. in `make release-check`) leaves the committed bundle
 * byte-identical (the former wall-clock stamp rewrote it on every build).
 */
function sourceBuildId(dir: string): string {
  const root = new URL(`${dir}/`, import.meta.url);
  const hash = createHash('sha256');
  const files = (readdirSync(root, { recursive: true }) as string[])
    .filter((file) => !file.includes('.test.') && statSync(new URL(file, root)).isFile())
    .sort();
  for (const file of files) {
    hash.update(file).update(readFileSync(new URL(file, root)));
  }
  hash.update(readFileSync(new URL('pnpm-lock.yaml', import.meta.url)));

  return hash.digest('hex').slice(0, 12);
}

/**
 * Vite configuration for the Icon Selector Bundle frontend assets.
 * Builds TypeScript to a single IIFE in `src/Resources/public` for Symfony `assets:install`
 * (output ends up at `public/bundles/nowoiconselector/icon-selector.js`).
 * Stimulus controller source is in Resources/assets/controllers/ for apps that use Stimulus (UX component pattern).
 */
export default defineConfig({
  define: {
    __ICON_SELECTOR_BUILD_TIME__: JSON.stringify(sourceBuildId('src/Resources/assets/src')),
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
