import { test, expect } from '@playwright/test';

/**
 * REQ-ASSETS-005 once-guard: the page loads icon-selector.js once from the template; adding the same script twice more
 * (a second copy, Turbo, a fragment) must not initialise the page again. One "script loaded" console line, the same
 * window.NowoIconSelector object, the same widget DOM, and no CSP violation.
 */
test('a script loaded three times logs once and initialises once', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('script loaded')) lines.push(msg.text());
  });

  const response = await page.goto('/bundle/form');
  expect(response?.status()).toBe(200);
  await expect(page.locator('div.icon-selector-widget[data-icon-selector-enhanced="1"]')).toHaveCount(3);

  const before = await page.evaluate(() => {
    (window as unknown as { __firstApi?: unknown }).__firstApi = (window as unknown as { NowoIconSelector?: unknown }).NowoIconSelector;
    return document.querySelectorAll('body *:not(script)').length;
  });

  const src = '/bundles/nowoiconselector/icon-selector.js';
  await page.addScriptTag({ url: src });
  await page.addScriptTag({ url: src });
  await page.waitForTimeout(300);

  expect(lines, 'script loaded lines').toHaveLength(1);
  // The text keeps the %c style markers between the parts.
  expect(lines[0]).toMatch(/📦 \[icon-selector\] script loaded, build: .*\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/);
  const after = await page.evaluate(() => ({
    sameApi: (window as unknown as { __firstApi?: unknown }).__firstApi === (window as unknown as { NowoIconSelector?: unknown }).NowoIconSelector,
    // No widget markup was built twice (the added <script> tags themselves are not counted).
    elements: document.querySelectorAll('body *:not(script)').length,
  }));
  expect(after.sameApi).toBe(true);
  expect(after.elements).toBe(before);
  await expect(page.locator('div.icon-selector-widget[data-icon-selector-enhanced="1"]')).toHaveCount(3);
});
