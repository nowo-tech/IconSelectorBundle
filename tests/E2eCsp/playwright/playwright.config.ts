import { defineConfig, devices } from '@playwright/test';

/**
 * Strict-CSP e2e for the bundle (no demo app): the PHP built-in server runs tests/E2eCsp/public/index.php.
 * E2E_BASE_URL points at it (default http://127.0.0.1:8765; `make test-e2e-csp` uses the compose service).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:8765',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
