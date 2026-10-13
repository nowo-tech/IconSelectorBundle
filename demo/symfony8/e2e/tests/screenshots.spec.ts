import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * REQ-DEMO-013 — README screenshots: the demo panel (title + lead + widget in situ),
 * without site nav or the Symfony WebProfiler toolbar.
 */
const outDir = process.env.SCREENSHOT_DIR
  ? resolve(process.env.SCREENSHOT_DIR)
  : resolve(__dirname, '../../../../docs/images/demo');

test.beforeAll(() => {
  mkdirSync(outDir, { recursive: true });
});

async function hideProfiler(page: Page): Promise<void> {
  await page.addStyleTag({ content: '.sf-toolbar, [id^="sfwdt"], .sf-minitoolbar { display: none !important; }' });
}

/** Screenshot the panel plus any floating element (e.g. an open dropdown) that overflows it. */
async function shotUnion(page: Page, panel: Locator, extra: Locator, file: string): Promise<void> {
  const a = await panel.boundingBox();
  const b = await extra.boundingBox();
  if (!a || !b) throw new Error('missing bounding box');
  const pad = 8;
  const x = Math.min(a.x, b.x) - pad;
  const y = Math.min(a.y, b.y) - pad;
  const w = Math.max(a.x + a.width, b.x + b.width) + pad - x;
  const h = Math.max(a.y + a.height, b.y + b.height) + pad - y;
  await page.screenshot({ path: resolve(outDir, file), clip: { x, y, width: w, height: h }, fullPage: true });
}

test.describe('feature screenshots', () => {
  test.use({ viewport: { width: 1024, height: 900 } });

  test('grid mode', async ({ page }) => {
    await page.goto('/en/demo/grid');
    await hideProfiler(page);
    await page.locator('.icon-selector-trigger').click();
    const dropdown = page.locator('.icon-selector-panel').first();
    await expect(dropdown.locator('.icon-selector-item').first()).toBeVisible();
    // Wait until the visible icons have their SVG bodies (lazy-loaded from Iconify).
    await expect(dropdown.locator('.icon-selector-item svg').nth(30)).toBeVisible({ timeout: 20_000 });
    await expect(dropdown.locator('.icon-selector-svg-placeholder')).toHaveCount(0, { timeout: 20_000 }).catch(() => undefined);
    await shotUnion(page, page.locator('[data-screenshot-target]'), dropdown, 'demo-grid.png');
  });

  test('tom select mode', async ({ page }) => {
    await page.goto('/en/demo/tom-select');
    await hideProfiler(page);
    await page.locator('.ts-control').first().click();
    const dropdown = page.locator('.ts-dropdown').first();
    // Opening with no value lists the first page of icons (each option = SVG + name).
    await expect(dropdown.locator('.option svg').nth(5)).toBeVisible({ timeout: 20_000 });
    await shotUnion(page, page.locator('[data-screenshot-target]'), dropdown, 'demo-tom-select.png');
  });
});
