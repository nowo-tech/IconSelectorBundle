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

/**
 * Audit ZBC-L2: Turbo Drive replaces the whole <body> on each visit and re-executes the scripts of the new body. With
 * the once-guard the re-executed copy does nothing, so the first copy's observers must still see the new body's widgets
 * (a shallow observer on <html> moves the body observer to the new <body>). Simulated without Turbo: fetch the page, swap in its <body>, add the
 * script again, twice (two visits).
 */
test('a body replacement (Turbo Drive visit) initialises the new widgets, on every visit', async ({ page }) => {
  const lines: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('script loaded')) lines.push(msg.text());
  });

  await page.goto('/bundle/form');
  await expect(page.locator('div.icon-selector-widget[data-icon-selector-enhanced="1"]')).toHaveCount(3);

  for (let visit = 1; visit <= 2; visit++) {
    await page.evaluate(async (n) => {
      const html = await (await fetch('/bundle/form')).text();
      const next = new DOMParser().parseFromString(html, 'text/html').body;
      next.dataset.visit = String(n);
      document.body.replaceWith(document.adoptNode(next));
    }, visit);
    await page.addScriptTag({ url: '/bundles/nowoiconselector/icon-selector.js' });

    await expect(page.locator(`body[data-visit="${visit}"]`)).toHaveCount(1);
    await expect(page.locator('div.icon-selector-widget[data-icon-selector-enhanced="1"]')).toHaveCount(3);
    const direct = page.locator('#icons_direct_icon_selector');
    await direct.locator('.icon-selector-trigger').click();
    await expect(direct.locator('.icon-selector-item').first()).toBeVisible();
  }

  expect(lines, 'script loaded lines').toHaveLength(1);
});
