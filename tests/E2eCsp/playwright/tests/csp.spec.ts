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

/*
 * 1.8 (Beacon / WikiBundle feedback): theme uikit, the picker's texts with a host translation_domain, no inline style
 * at all (not even through element.style), dark mode, and a Save button outside the form.
 */
const BOOTSTRAP_CLASS = /\b(form-control|form-select|btn|bg-white|border|rounded|shadow-sm|d-flex|d-inline-flex|mb-2|mt-2|p-2|text-muted|small)\b/;

/** Classes of every element inside the icon-selector widgets that carry a Bootstrap utility class. */
async function bootstrapClassesInWidgets(page: Page): Promise<string[]> {
  return page.evaluate((source) => {
    const re = new RegExp(source);
    return Array.from(document.querySelectorAll('.icon-selector-widget [class]'))
      .map((el) => el.getAttribute('class') ?? '')
      .filter((c) => re.test(c));
  }, BOOTSTRAP_CLASS.source);
}

/** Elements inside the widgets with a style attribute (CSSOM writes show up as one too). */
async function styledInWidgets(page: Page): Promise<string[]> {
  return page.evaluate(() => Array.from(document.querySelectorAll('.icon-selector-widget [style], .icon-selector-widget[style]')).map((el) => el.outerHTML.slice(0, 120)));
}

/** Relative luminance (0..1) of a computed rgb()/rgba() colour. */
async function luminance(page: Page, selector: string, property: 'background-color' | 'color'): Promise<number> {
  return page.locator(selector).first().evaluate((el, prop) => {
    const m = getComputedStyle(el).getPropertyValue(prop).match(/[\d.]+/g) ?? ['0', '0', '0'];
    const [r, g, b] = m.slice(0, 3).map((v) => Number(v) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }, property);
}

test.describe('theme uikit (Beacon)', () => {
  test('no Bootstrap class, no inline style, no raw translation key; search, pick, Save outside the form', async ({ page, baseURL }) => {
    const w = await watch(page, baseURL!);
    const response = await page.goto('/uikit/form');
    const html = await response!.text();
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).not.toMatch(/(>|=")\s*(search_placeholder|placeholder|no_icons)\s*(<|")/);

    const direct = page.locator('#icons_direct_icon_selector');
    const search = page.locator('#icons_search_icon_selector');
    await expect(direct).toHaveAttribute('data-icon-selector-enhanced', '1');
    await expect(search).toHaveAttribute('data-icon-selector-enhanced', '1');
    await expect(search).toHaveAttribute('data-icon-selector-theme-value', 'uikit');

    // Lazy load: nothing in the grid until the panel opens.
    await expect(search.locator('.icon-selector-item')).toHaveCount(0);
    const trigger = search.locator('.icon-selector-trigger');
    await expect(trigger).toHaveText('Choose icon...');
    await expect(search.locator('.icon-selector-picker-widget.icon-selector-iconify-widget')).toHaveCount(1);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const box = search.getByRole('textbox', { name: 'Search icons...' });
    await expect(box).toHaveAttribute('placeholder', 'Search icons...');
    await box.fill('user');
    const pick = search.locator('.icon-selector-item[data-icon-id="tabler:user-circle"]');
    await expect(pick).toBeVisible();
    await pick.click();
    await expect(page.locator('input[name="icons[search]"]')).toHaveValue('tabler:user-circle');
    await expect(search.locator('.icon-selector-panel')).toBeHidden();

    // Emoji tab, then back: the icon part is hidden with the hidden attribute only.
    await search.getByRole('tab', { name: 'Emoji' }).click();
    await expect(search.locator('.icon-selector-picker')).toBeHidden();
    await search.getByRole('tab', { name: 'Icons' }).click();
    await expect(search.locator('.icon-selector-picker')).toBeVisible();

    await direct.locator('.icon-selector-trigger').click();
    await direct.locator('.icon-selector-item[data-icon-id="tabler:star"]').click();

    expect(await bootstrapClassesInWidgets(page)).toEqual([]);
    expect(await styledInWidgets(page)).toEqual([]);

    await page.getByRole('button', { name: 'Save outside' }).click();
    await expect(page.locator('#saved')).toContainText('"search":"tabler:user-circle"');
    await expect(page.locator('#saved')).toContainText('"direct":"tabler:star"');
    await expectClean(page, w);
  });

  test('a submit while the picker loads is held and sent once it is ready (not lost)', async ({ page, baseURL }) => {
    const w = await watch(page, baseURL!);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/uikit/api/icon-selector/config*', async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto('/uikit/form', { waitUntil: 'domcontentloaded' });
    const search = page.locator('#icons_search_icon_selector');
    await expect(search).toHaveAttribute('data-icon-selector-ready', '0');
    await expect(page.getByRole('button', { name: 'Save outside' })).toBeDisabled();
    // Emoji mode: the value field is a text input until the widget is set up.
    await page.locator('input[name="icons[search]"]').fill('tabler:home');
    await page.evaluate(() => (document.getElementById('icons-form') as HTMLFormElement).requestSubmit());
    await page.waitForTimeout(300);
    await expect(page.locator('#saved')).toHaveCount(0);
    release();
    await expect(page.locator('#saved')).toContainText('"search":"tabler:home"');
    await expectClean(page, w);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`prefers-color-scheme ${scheme}: the panel follows it without UiKit's stylesheet`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/uikit/form');
      const search = page.locator('#icons_search_icon_selector');
      await expect(search).toHaveAttribute('data-icon-selector-enhanced', '1');
      await search.locator('.icon-selector-trigger').click();
      const bg = await luminance(page, '#icons_search_icon_selector .icon-selector-panel', 'background-color');
      const fg = await luminance(page, '#icons_search_icon_selector .icon-selector-trigger', 'color');
      if (scheme === 'dark') {
        expect(bg).toBeLessThan(0.1);
        expect(fg).toBeGreaterThan(0.5);
      } else {
        expect(bg).toBeGreaterThan(0.9);
        expect(fg).toBeLessThan(0.1);
      }
    });
  }

  test('UiKit data-theme="dark" wins over a light OS setting, with and without the UiKit tokens', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    for (const url of ['/uikit/form?theme=dark', '/uikit/form?theme=dark&tokens=1']) {
      await page.goto(url);
      const search = page.locator('#icons_search_icon_selector');
      await expect(search).toHaveAttribute('data-icon-selector-enhanced', '1');
      await search.locator('.icon-selector-trigger').click();
      expect(await luminance(page, '#icons_search_icon_selector .icon-selector-panel', 'background-color'), url).toBeLessThan(0.1);
    }
    // With the tokens the panel uses the UiKit surface colour itself.
    const surface = await page.locator('#icons_search_icon_selector .icon-selector-panel').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(surface).toBe('rgb(17, 24, 39)');

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/uikit/form?theme=light&tokens=1');
    await page.locator('#icons_search_icon_selector .icon-selector-trigger').click();
    expect(await page.locator('#icons_search_icon_selector .icon-selector-panel').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  });
});

test('theme bootstrap (default without UiKit) keeps the 1.7 classes and sets no inline style', async ({ page }) => {
  await page.goto('/local/form');
  const search = page.locator('#icons_search_icon_selector');
  await expect(search).toHaveAttribute('data-icon-selector-theme-value', 'bootstrap');
  await expect(search).toHaveAttribute('data-icon-selector-enhanced', '1');
  await search.locator('.icon-selector-trigger').click();
  await expect(search.locator('.icon-selector-panel')).toHaveClass(/\bborder rounded shadow-sm p-2 bg-white\b/);
  await expect(search.locator('.icon-selector-trigger')).toHaveClass(/\bform-control form-control-sm\b/);
  await expect(search.locator('.icon-selector-item').first()).toBeVisible();
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('#icons_search_icon_selector [style], #icons_direct_icon_selector [style]')).length)).toBe(0);
});
