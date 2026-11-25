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
    await expect(page.locator('[data-icon-selector-target="trigger"]')).toBeHidden();

    // 1.9.2: the Emoji tab shows a trigger; its panel floats like the icon panel.
    const emojiTrigger = page.locator('.icon-selector-emoji-trigger');
    await expect(emojiTrigger).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Tab');
    await expect(emojiTrigger).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(emojiTrigger).toHaveAttribute('aria-expanded', 'true');
    const grid = page.getByRole('group', { name: 'Emoji' });
    await expect(grid.locator('.icon-selector-emoji-item').first()).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search emoji...' }).fill('rocket');
    const rocket = grid.getByRole('button', { name: 'rocket', exact: true });
    await rocket.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('input[name$="[icon_emoji]"]')).toHaveValue('emoji:🚀');
    // A pick closes the panel and gives focus back to the trigger, which shows the emoji.
    await expect(page.locator('.icon-selector-emoji-panel')).toBeHidden();
    await expect(emojiTrigger).toBeFocused();
    await expect(emojiTrigger).toHaveAccessibleName('Selected: 🚀 rocket');
    await expect(page.locator('.icon-selector-emoji-current')).toHaveText('rocket');
    await emojiTrigger.click();
    await expect(rocket).toHaveAttribute('aria-pressed', 'true');
    // The open panel floats over the Save button: close it first.
    await page.keyboard.press('Escape');
    await expect(page.locator('.icon-selector-emoji-panel')).toBeHidden();

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.nowo-ui-flash--success')).toContainText('emoji:🚀');
    await expect(page.getByRole('img', { name: 'rocket' })).toHaveText('🚀');
    // Reloaded with an emoji value: the field opens on the Emoji tab.
    await expect(page.getByRole('tab', { name: 'Emoji' })).toHaveAttribute('aria-selected', 'true');
  });

  test('emoji tab: skin tone and arrow-key navigation', async ({ page }) => {
    await page.goto('/en/demo/emoji');
    await page.getByRole('tab', { name: 'Emoji' }).click();
    await page.locator('.icon-selector-emoji-trigger').click();
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

  /**
   * 1.9.2 (Beacon report 2026-11-25): opening the picker on the Emoji tab pushed the page content down. Both tabs now
   * open the same floating panel: the form and what follows it keep their place.
   */
  test('emoji + icons: opening either panel does not move the page, flips up near the bottom, Escape / outside click close', async ({ page }) => {
    await page.goto('/en/demo/emoji');
    await expect(page.locator('div.icon-selector-widget[data-icon-selector-enhanced="1"]')).toBeAttached();
    const form = page.locator('#demo-form');
    const save = page.getByRole('button', { name: 'Save' });
    const layout = async (): Promise<number[]> => {
      const f = await form.boundingBox();
      const s = await save.boundingBox();
      if (!f || !s) throw new Error('missing bounding box');
      return [Math.round(f.height), Math.round(s.y)];
    };

    // Icons tab.
    const before = await layout();
    const iconTrigger = page.locator('[data-icon-selector-target="trigger"]');
    await iconTrigger.click();
    const iconPanel = page.locator('[data-icon-selector-target="panel"]');
    await expect(iconPanel).toBeVisible();
    expect(await layout()).toEqual(before);
    await iconPanel.locator('input').first().focus();
    await page.keyboard.press('Escape');
    await expect(iconPanel).toBeHidden();
    await expect(iconTrigger).toBeFocused();

    // Emoji tab: the tab row is part of the field from the start, so switching tabs alone keeps the layout too.
    await page.getByRole('tab', { name: 'Emoji' }).click();
    expect(await layout()).toEqual(before);
    const trigger = page.locator('.icon-selector-emoji-trigger');
    const panel = page.locator('.icon-selector-emoji-panel');
    await trigger.click();
    await expect(panel.locator('.icon-selector-emoji-item').first()).toBeVisible();
    expect(await layout()).toEqual(before);
    // Same anchor and width as the icon panel: right under the trigger, as wide as the field.
    const t = (await trigger.boundingBox())!;
    const p = (await panel.boundingBox())!;
    expect(p.y).toBeGreaterThanOrEqual(t.y + t.height);
    expect(Math.round(p.x)).toBe(Math.round(t.x));
    expect(Math.round(p.width)).toBe(Math.round(t.width));
    expect(await panel.evaluate((el) => getComputedStyle(el).position)).toBe('absolute');

    // Escape inside the panel closes it and gives focus back to the trigger.
    await page.getByRole('searchbox', { name: 'Search emoji...' }).focus();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Outside click closes it.
    await trigger.click();
    await expect(panel).toBeVisible();
    await page.locator('h1').first().click();
    await expect(panel).toBeHidden();

    // Near the bottom of the viewport it opens upwards, still without moving anything.
    const box = (await trigger.boundingBox())!;
    await page.setViewportSize({ width: 1280, height: Math.ceil(box.y + box.height + 60) });
    const short = await layout();
    await trigger.click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-icon-selector-placement', 'above');
    const up = (await panel.boundingBox())!;
    const tr = (await trigger.boundingBox())!;
    expect(up.y + up.height).toBeLessThanOrEqual(tr.y + 1);
    expect(await layout()).toEqual(short);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(panel).not.toHaveAttribute('data-icon-selector-placement', 'above');
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

  test('emoji + Tom Select: a stored emoji survives a re-save (audit RO-1)', async ({ page }) => {
    const iconify: string[] = [];
    page.on('request', (r) => { if (r.url().includes('api.iconify.design') && r.url().includes('emoji')) iconify.push(r.url()); });
    await page.goto('/en/demo/emoji?mode=tom_select&icon=' + encodeURIComponent('emoji:🚀'));
    await expect(page.locator('div.icon-selector-widget[data-icon-selector-enhanced="1"]')).toBeAttached();
    await expect(page.locator('select[name$="[icon_emoji]"]')).toHaveValue('emoji:🚀');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.nowo-ui-flash--success')).toContainText('emoji:🚀');
    expect(iconify).toEqual([]);
  });
});
