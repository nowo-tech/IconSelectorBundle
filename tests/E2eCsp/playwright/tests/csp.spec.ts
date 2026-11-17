import { test, expect, type Page } from '@playwright/test';

/**
 * Beacon report (IconSelector 1.6 in WikiBundle under a nonce-only CSP):
 *  - no injected inline <style> and no style= attribute (style-src 'self' 'nonce-…');
 *  - with a same-origin source the browser never contacts api.iconify.design or any other third party.
 *
 * Every request to another origin is recorded and aborted; every `securitypolicyviolation` event and every CSP
 * console error is recorded. Each scenario drives all three widget modes and asserts both lists stay empty.
 */

interface Violation {
  directive: string;
  blocked: string;
  sample: string;
}

interface Watch {
  thirdParty: string[];
  consoleCsp: string[];
  violations: () => Promise<Violation[]>;
}

async function watch(page: Page, baseURL: string): Promise<Watch> {
  const origin = new URL(baseURL).origin;
  const thirdParty: string[] = [];
  const consoleCsp: string[] = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (new URL(url).origin !== origin) {
      thirdParty.push(url);
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) consoleCsp.push(msg.text());
  });
  await page.addInitScript(() => {
    (window as unknown as { __csp: Violation[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __csp: Violation[] }).__csp.push({
        directive: e.violatedDirective,
        blocked: e.blockedURI,
        sample: e.sample,
      });
    });
  });
  return {
    thirdParty,
    consoleCsp,
    violations: () => page.evaluate(() => (window as unknown as { __csp: Violation[] }).__csp),
  };
}

async function expectClean(page: Page, w: Watch): Promise<void> {
  // Let late fetches / style recalculations settle before reading the lists.
  await page.waitForTimeout(300);
  expect(await w.violations(), 'CSP violations').toEqual([]);
  expect(w.consoleCsp, 'CSP console errors').toEqual([]);
  expect(w.thirdParty, 'third-party requests').toEqual([]);
}

const scenarios = [
  // bundle: static tabler list (icons not committed render a placeholder); local: committed fixture icons only.
  { source: 'bundle', expectedIcons: null as string[] | null, searchPick: 'tabler:user' },
  { source: 'local', expectedIcons: ['tabler:home', 'tabler:star', 'tabler:user-circle'], searchPick: 'tabler:user-circle' },
];

for (const { source, expectedIcons, searchPick } of scenarios) {
  test.describe(`source ${source}`, () => {
    test('nonce-only CSP: zero violations and zero third-party requests in every mode', async ({ page, baseURL }) => {
      const w = await watch(page, baseURL!);
      const response = await page.goto(`/${source}/form`);
      expect(response?.status()).toBe(200);
      expect(response?.headers()['content-security-policy']).toContain("style-src 'self' 'nonce-");

      // The page markup itself carries no inline style.
      const html = await response!.text();
      expect(html).not.toMatch(/<style\b/i);
      expect(html).not.toMatch(/\sstyle\s*=/i);
      expect(html).toContain('/bundles/nowoiconselector/icon-selector.css');

      await expect(page.locator('div.icon-selector-widget[data-icon-selector-enhanced="1"]')).toHaveCount(3);

      // direct (grid) mode
      const direct = page.locator('#icons_direct_icon_selector');
      await direct.locator('.icon-selector-trigger').click();
      const items = direct.locator('.icon-selector-item');
      await expect(items.first()).toBeVisible();
      if (expectedIcons) {
        await expect(items).toHaveCount(expectedIcons.length);
        expect(await items.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.iconId))).toEqual(expectedIcons);
      }
      const star = direct.locator('.icon-selector-item[data-icon-id="tabler:star"]');
      await expect(star.locator('svg path')).toBeAttached();
      await star.click();
      await expect(page.locator('input[name="icons[direct]"]')).toHaveValue('tabler:star');

      // search mode (same widget, filtered by the panel search box)
      const search = page.locator('#icons_search_icon_selector');
      await search.locator('.icon-selector-trigger').click();
      await search.locator('.icon-selector-panel input').fill('user');
      const userItem = search.locator(`.icon-selector-item[data-icon-id="${searchPick}"]`);
      await expect(userItem).toBeVisible();
      await userItem.click();
      await expect(page.locator('input[name="icons[search]"]')).toHaveValue(searchPick);

      // tom_select mode: options with SVG; the stylesheet (not a style attribute) sizes the icon box.
      const tom = page.locator('#icons_tom_icon_selector');
      await tom.locator('.ts-control').click();
      const options = page.locator('.ts-dropdown .option');
      await expect(options.first()).toBeVisible();
      const homeOption = page.locator('.ts-dropdown .option[data-value="tabler:home"]');
      await expect(homeOption.locator('svg')).toBeAttached();
      const box = await homeOption.locator('.icon-selector-option-svg').evaluate((el) => getComputedStyle(el).width);
      expect(box).toBe('20px');
      if (expectedIcons) {
        expect(await options.evaluateAll((els) => els.map((e) => e.getAttribute('data-value')))).toEqual(expectedIcons);
      }
      await page.locator('.ts-dropdown .option[data-value="tabler:star"]').click();

      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('#saved')).toContainText('"direct":"tabler:star"');
      await expect(page.locator('#saved')).toContainText('"tom":"tabler:star"');

      await expectClean(page, w);
    });
  });
}

test('bootstrap 5 theme, emoji: true and icon_prefixes: zero violations and zero third-party requests', async ({ page, baseURL }) => {
  const w = await watch(page, baseURL!);
  const response = await page.goto('/bs5/form');
  expect(response?.status()).toBe(200);
  const html = await response!.text();
  expect(html).not.toMatch(/<style\b/i);
  expect(html).not.toMatch(/\sstyle\s*=/i);

  const direct = page.locator('#icons_direct_icon_selector');
  const search = page.locator('#icons_search_icon_selector');
  await expect(direct).toHaveAttribute('data-icon-selector-enhanced', '1');
  await expect(search).toHaveAttribute('data-icon-selector-enhanced', '1');

  // icon_prefixes ['tabler']: only the committed tabler icons.
  await direct.locator('.icon-selector-trigger').click();
  const items = direct.locator('.icon-selector-item');
  await expect(items.first()).toBeVisible();
  expect(await items.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.iconId))).toEqual(['tabler:home', 'tabler:star', 'tabler:user-circle']);

  // Emoji tab (CSSOM styles only): pick an emoji.
  await direct.getByRole('tab', { name: /emoji/i }).click();
  const emoji = direct.locator('.icon-selector-emoji-item').first();
  await expect(emoji).toBeVisible();
  await emoji.click();
  await expect(page.locator('input[name="icons[direct]"]')).toHaveValue(/^emoji:/);

  // icon_prefixes ['bi'] on the search field: only bi:house.
  await search.locator('.icon-selector-trigger').click();
  const biItems = search.locator('.icon-selector-item');
  await expect(biItems.first()).toBeVisible();
  expect(await biItems.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.iconId))).toEqual(['bi:house']);
  await biItems.first().click();

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('#saved')).toContainText('"search":"bi:house"');
  await expect(page.locator('#saved')).toContainText('"direct":"emoji:');

  await expectClean(page, w);
});

test('the harness detects an injected <style> under the policy', async ({ page, baseURL }) => {
  const w = await watch(page, baseURL!);
  await page.goto('/local/form');
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = 'body{color:red}';
    document.head.appendChild(style);
  });
  await expect.poll(async () => (await w.violations()).map((v) => v.directive)).toContain('style-src-elem');
});

test('the harness records third-party requests', async ({ page, baseURL }) => {
  const w = await watch(page, baseURL!);
  // about:blank has no CSP: the request reaches the router, which records and aborts it.
  await page.setContent('<img src="https://api.iconify.design/tabler/home.svg" alt="">');
  await expect.poll(() => w.thirdParty).toEqual(['https://api.iconify.design/tabler/home.svg']);
});

test('ux_icons_local refuses a submitted icon that is not committed', async ({ page, request, baseURL }) => {
  await watch(page, baseURL!);
  const response = await request.post('/local/form', { form: { 'icons[direct]': 'tabler:settings' } });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('&quot;invalid&quot;');
});
