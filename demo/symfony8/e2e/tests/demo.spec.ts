import { test, expect } from '@playwright/test';

/**
 * REQ-DEMO-013 — happy-path e2e against the Symfony 8 demo.
 */
test.describe('icon selector demo', () => {
  test('home lists the demo pages', async ({ page }) => {
    const response = await page.goto('/en/');
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('a[href="/en/demo/grid"]').first()).toBeVisible();
    await expect(page.locator('a[href="/en/demo/tom-select"]').first()).toBeVisible();
  });

  test('grid mode: pick an icon and save it', async ({ page }) => {
    await page.goto('/en/demo/grid');
    await expect(page.locator('div.icon-selector-widget[data-icon-selector-enhanced="1"]')).toBeAttached();
    await page.locator('.icon-selector-trigger').click();
    const firstIcon = page.locator('.icon-selector-item').first();
    await expect(firstIcon).toBeVisible();
    await firstIcon.click();
    const value = await page.locator('input[name="form[icon_direct]"]').inputValue();
    expect(value).not.toBe('');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.alert-success')).toContainText(value);
  });

  test('tom select mode: dropdown shows icons', async ({ page }) => {
    await page.goto('/en/demo/tom-select');
    await page.locator('.ts-control').first().click();
    const options = page.locator('.ts-dropdown .option');
    await expect(options.first()).toBeVisible();
    await expect(options.first().locator('svg')).toBeVisible();
  });
});
