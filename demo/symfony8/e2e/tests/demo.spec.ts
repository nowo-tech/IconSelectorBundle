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
    const value = await page.locator('input[name$="[icon_direct]"]').inputValue();
    expect(value).not.toBe('');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.nowo-ui-flash--success')).toContainText(value);
  });

  test('tom select mode: dropdown shows icons', async ({ page }) => {
    await page.goto('/en/demo/tom-select');
    await page.locator('.ts-control').first().click();
    const options = page.locator('.ts-dropdown .option');
    await expect(options.first()).toBeVisible();
    await expect(options.first().locator('svg')).toBeVisible();
  });

  test('emoji tab: keyboard tabs, search, pick and save', async ({ page }) => {
    await page.goto('/en/demo/emoji');
    await expect(page.locator('div.icon-selector-widget[data-icon-selector-enhanced="1"]')).toBeAttached();
    const iconsTab = page.getByRole('tab', { name: 'Icons' });
    const emojiTab = page.getByRole('tab', { name: 'Emoji' });
    await expect(iconsTab).toHaveAttribute('aria-selected', 'true');
    await iconsTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(emojiTab).toHaveAttribute('aria-selected', 'true');
    await expect(emojiTab).toBeFocused();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await expect(page.locator('.icon-selector-trigger')).toBeHidden();

    const grid = page.getByRole('group', { name: 'Emoji' });
    await expect(grid.locator('.icon-selector-emoji-item').first()).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search emoji...' }).fill('rocket');
    const rocket = grid.getByRole('button', { name: 'rocket', exact: true });
    await rocket.focus();
    await page.keyboard.press('Enter');
    await expect(rocket).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('input[name$="[icon_emoji]"]')).toHaveValue('emoji:🚀');
    await expect(page.locator('.icon-selector-emoji-current')).toContainText('🚀 rocket');

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.nowo-ui-flash--success')).toContainText('emoji:🚀');
    await expect(page.getByRole('img', { name: 'rocket' })).toHaveText('🚀');
    // Reloaded with an emoji value: the field opens on the Emoji tab.
    await expect(page.getByRole('tab', { name: 'Emoji' })).toHaveAttribute('aria-selected', 'true');
  });

  test('emoji tab: skin tone and arrow-key navigation', async ({ page }) => {
    await page.goto('/en/demo/emoji');
    await page.getByRole('tab', { name: 'Emoji' }).click();
    await page.getByRole('searchbox', { name: 'Search emoji...' }).fill('waving hand');
    await page.getByRole('combobox', { name: 'Skin tone' }).selectOption({ label: 'Medium' });
    const item = page.locator('.icon-selector-emoji-item').first();
    await expect(item).toHaveText('👋🏽');
    await page.getByRole('searchbox', { name: 'Search emoji...' }).fill('');
    const first = page.locator('.icon-selector-emoji-item').first();
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.icon-selector-emoji-item').nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator('.icon-selector-emoji-item').last()).toBeFocused();
  });

  test('emoji: the server rejects anything but one RGI emoji', async ({ page }) => {
    await page.goto('/en/demo/emoji');
    await expect(page.locator('div.icon-selector-widget[data-icon-selector-enhanced="1"]')).toBeAttached();
    for (const bad of ['emoji:rocket', 'emoji:🚀🚀', 'emoji:\u202e🚀']) {
      await page.locator('input[name$="[icon_emoji]"]').evaluate((el, v) => { (el as HTMLInputElement).value = v; }, bad);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('.nowo-ui-flash--success')).toHaveCount(0);
      await expect(page.locator('[data-testid="demo-case"]')).toContainText(/not valid|invalid/i);
    }
  });

  test('emoji: without JavaScript the field is a text input', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/en/demo/emoji');
    const input = page.locator('input[name$="[icon_emoji]"]');
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).toBeVisible();
    await input.fill('emoji:🎉');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.nowo-ui-flash--success')).toContainText('emoji:🎉');
    await context.close();
  });
});
