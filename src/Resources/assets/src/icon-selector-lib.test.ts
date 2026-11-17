/**
 * Unit tests for the icon selector library: getOptionsFromScript, IconSelectorWidget, and runInit.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  disposeIconSelectorContainer,
  getOptionsFromScript,
  IconSelectorWidget,
  IconSelectorIconifyWidget,
  ATTR_EMPTY_TEXT,
  runInit,
  runInitAndObserve,
  initIconSelectorContainer,
  ATTR_MODE,
  ATTR_URL,
  ATTR_SEARCH_PLACEHOLDER,
  fetchIconifyIconsBatch,
} from './icon-selector-lib';

/** Mock TomSelect to avoid DOM/constructor side effects in initTomSelect tests. */
vi.mock('tom-select', () => ({
  // Vitest 4: a mock used with `new` needs a `function`/`class` implementation.
  default: vi.fn().mockImplementation(function () {
    return { destroy: vi.fn() };
  }),
}));

/** Tests for reading options from the script tag (icon-selector-options-{id}). */
describe('getOptionsFromScript', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when no script element exists', () => {
    expect(getOptionsFromScript('missing-id')).toBeNull();
  });

  it('returns null when script has no text content', () => {
    const script = document.createElement('script');
    script.id = 'icon-selector-options-my-field';
    script.type = 'application/json';
    document.body.appendChild(script);
    expect(getOptionsFromScript('my-field')).toBeNull();
  });

  it('returns parsed array when script contains valid JSON array', () => {
    const script = document.createElement('script');
    script.id = 'icon-selector-options-my-field';
    script.type = 'application/json';
    script.textContent = JSON.stringify([
      { value: 'heroicons-outline:home', text: 'home', svg: '<svg></svg>' },
    ]);
    document.body.appendChild(script);
    const result = getOptionsFromScript('my-field');
    expect(result).toHaveLength(1);
    expect(result![0]).toEqual({ value: 'heroicons-outline:home', text: 'home', svg: '<svg></svg>' });
  });

  it('returns null when script contains invalid JSON', () => {
    const script = document.createElement('script');
    script.id = 'icon-selector-options-bad';
    script.type = 'application/json';
    script.textContent = 'not json {';
    document.body.appendChild(script);
    expect(getOptionsFromScript('bad')).toBeNull();
  });

  it('returns null when script content is not an array', () => {
    const script = document.createElement('script');
    script.id = 'icon-selector-options-obj';
    script.type = 'application/json';
    script.textContent = JSON.stringify({ foo: 'bar' });
    document.body.appendChild(script);
    expect(getOptionsFromScript('obj')).toBeNull();
  });
});

/** Tests for IconSelectorWidget: placeholder, API response, icons_by_set fallback. */
describe('IconSelectorWidget', () => {
  let container: HTMLElement;
  let input: HTMLInputElement;
  let picker: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    input = document.createElement('input');
    input.type = 'text';
    input.name = 'icon';
    picker = document.createElement('div');
    container.appendChild(input);
    container.appendChild(picker);
    document.body.appendChild(container);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('uses search placeholder from container data attribute', async () => {
    container.setAttribute(ATTR_SEARCH_PLACEHOLDER, 'Buscar iconos...');
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        json: async () => ({ icons: ['heroicons-outline:home'] }),
      })
      .mockResolvedValueOnce({ json: async () => ({}) });
    const widget = new IconSelectorWidget(container, input, picker, '/api/icons', 'search');
    await vi.waitFor(() => {
      const searchEl = picker.querySelector<HTMLInputElement>('.icon-selector-search');
      expect(searchEl).not.toBeNull();
      expect(searchEl!.placeholder).toBe('Buscar iconos...');
    });
  });

  it('uses search placeholder from constructor argument', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        json: async () => ({ icons: ['heroicons-outline:home'] }),
      })
      .mockResolvedValueOnce({ json: async () => ({}) });
    const widget = new IconSelectorWidget(
      container,
      input,
      picker,
      '/api/icons',
      'search',
      'Custom placeholder',
    );
    await vi.waitFor(() => {
      const searchEl = picker.querySelector<HTMLInputElement>('.icon-selector-search');
      expect(searchEl?.placeholder).toBe('Custom placeholder');
    });
  });

  it('renders icon buttons from API response after opening panel', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ icons: ['heroicons-outline:home', 'bi:house'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'heroicons-outline:home': '<svg>home</svg>',
          'bi:house': '<svg>house</svg>',
        }),
      });
    new IconSelectorWidget(container, input, picker, '/api/icons', 'direct');
    const trigger = await vi.waitFor(() => {
      const el = picker.querySelector<HTMLElement>('.icon-selector-trigger');
      if (!el) throw new Error('trigger not found');
      return el;
    });
    trigger.click();
    await vi.waitFor(() => {
      const buttons = picker.querySelectorAll('.icon-selector-item');
      expect(buttons.length).toBe(2);
      expect(buttons[0].getAttribute('data-icon-id')).toBe('heroicons-outline:home');
      const wrap0 = buttons[0].querySelector('.icon-selector-svg-wrap');
      expect(wrap0).not.toBeNull();
      expect((wrap0 as HTMLElement).innerHTML).toContain('home');
      expect(buttons[1].getAttribute('data-icon-id')).toBe('bi:house');
      const wrap1 = buttons[1].querySelector('.icon-selector-svg-wrap');
      expect(wrap1).not.toBeNull();
      expect((wrap1 as HTMLElement).innerHTML).toContain('house');
    });
  });

  it('uses icons_by_set when icons array is missing', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          icons_by_set: {
            heroicons: ['heroicons-outline:home'],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'heroicons-outline:home': '<svg></svg>' }),
      });
    new IconSelectorWidget(container, input, picker, '/api/icons', 'direct');
    const trigger = await vi.waitFor(() => {
      const el = picker.querySelector<HTMLElement>('.icon-selector-trigger');
      if (!el) throw new Error('trigger not found');
      return el;
    });
    trigger.click();
    await vi.waitFor(() => {
      const buttons = picker.querySelectorAll('.icon-selector-item');
      expect(buttons.length).toBe(1);
      expect(buttons[0].getAttribute('data-icon-id')).toBe('heroicons-outline:home');
    });
  });
});

/** Tests for runInit: container discovery, single init, no double-init. */
describe('runInit', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ icons: [] }) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('sets data-icon-selector-init on container and finds input and picker', async () => {
    const container = document.createElement('div');
    container.setAttribute('data-controller', 'icon-selector');
    container.setAttribute(ATTR_URL, '/api/icons');
    container.setAttribute(ATTR_MODE, 'direct');
    const input = document.createElement('input');
    input.setAttribute('data-icon-selector-target', 'input');
    input.className = 'icon-selector-input';
    const picker = document.createElement('div');
    picker.setAttribute('data-icon-selector-target', 'picker');
    picker.className = 'icon-selector-picker';
    container.appendChild(input);
    container.appendChild(picker);
    document.body.appendChild(container);

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ json: async () => ({ icons: [] }) });

    runInit();

    expect(container.getAttribute('data-icon-selector-init')).toBe('1');
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/icons');
    });
  });

  it('does not double-init when data-icon-selector-init is already 1', () => {
    const container = document.createElement('div');
    container.setAttribute('data-controller', 'icon-selector');
    container.setAttribute('data-icon-selector-init', '1');
    container.setAttribute(ATTR_URL, '/api/icons');
    container.setAttribute(ATTR_MODE, 'direct');
    const input = document.createElement('input');
    input.setAttribute('data-icon-selector-target', 'input');
    const picker = document.createElement('div');
    picker.setAttribute('data-icon-selector-target', 'picker');
    container.appendChild(input);
    container.appendChild(picker);
    document.body.appendChild(container);

    runInit();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('runInitAndObserve starts observer and initIconSelectorContainer initializes a single container', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ json: async () => ({ sets: [] }) })
      .mockResolvedValueOnce({ json: async () => ({ icons: [] }) });
    const container = document.createElement('div');
    container.setAttribute('data-controller', 'icon-selector');
    container.setAttribute(ATTR_URL, '/api/icons');
    container.setAttribute(ATTR_MODE, 'direct');
    const input = document.createElement('input');
    input.setAttribute('data-icon-selector-target', 'input');
    input.className = 'icon-selector-input';
    const picker = document.createElement('div');
    picker.setAttribute('data-icon-selector-target', 'picker');
    picker.className = 'icon-selector-picker';
    container.appendChild(input);
    container.appendChild(picker);

    const cleanup = initIconSelectorContainer(container);
    expect(typeof cleanup).toBe('function');
    expect(container.getAttribute('data-icon-selector-init')).toBe('1');

    document.body.appendChild(container);
    runInitAndObserve();
    expect(container.getAttribute('data-icon-selector-init')).toBe('1');
  });

  it('disposeIconSelectorContainer removes init markers for reconnect', () => {
    const container = document.createElement('div');
    container.setAttribute('data-controller', 'icon-selector');
    container.setAttribute(ATTR_URL, '/api/icons');
    container.setAttribute(ATTR_MODE, 'direct');
    const input = document.createElement('input');
    input.setAttribute('data-icon-selector-target', 'input');
    input.className = 'icon-selector-input';
    const picker = document.createElement('div');
    picker.setAttribute('data-icon-selector-target', 'picker');
    picker.className = 'icon-selector-picker';
    container.appendChild(input);
    container.appendChild(picker);

    const cleanup = initIconSelectorContainer(container);
    expect(typeof cleanup).toBe('function');

    disposeIconSelectorContainer(container);

    expect(container.hasAttribute('data-icon-selector-init')).toBe(false);
    expect(container.hasAttribute('data-icon-selector-ready')).toBe(false);
    expect(container.hasAttribute('data-icon-selector-enhanced')).toBe(false);
  });

  it('initIconSelectorContainer returns false for element without data-controller icon-selector', () => {
    const div = document.createElement('div');
    div.setAttribute('data-controller', 'other');
    expect(initIconSelectorContainer(div)).toBe(false);
  });

  it('initIconSelectorContainer returns false when already initialized', () => {
    const container = document.createElement('div');
    container.setAttribute('data-controller', 'icon-selector');
    container.setAttribute('data-icon-selector-init', '1');
    container.setAttribute(ATTR_URL, '/api/icons');
    expect(initIconSelectorContainer(container)).toBe(false);
  });

  it('initIconSelectorContainer returns false when container has no input and picker', () => {
    const container = document.createElement('div');
    container.setAttribute('data-controller', 'icon-selector');
    container.setAttribute(ATTR_URL, '/api/icons');
    container.setAttribute(ATTR_MODE, 'direct');
    expect(initIconSelectorContainer(container)).toBe(false);
  });
});

/** Iconify API responses are third-party content injected via innerHTML: they must be sanitized. */
describe('fetchIconifyIconsBatch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sanitizes icon bodies and coerces dimensions from the Iconify API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          width: 24,
          height: 24,
          icons: {
            safe: { body: '<path fill="currentColor" d="M1 1h22v22H1z"/>' },
            evil: {
              body: '<path d="M0 0" onload="alert(1)"/><script>alert(2)</script><foreignObject><img xmlns="http://www.w3.org/1999/xhtml" src="x" onerror="alert(3)"/></foreignObject>',
              width: '24" onload="alert(4)',
            },
            // Not well-formed XML (HTML-style unquoted attributes): dropped entirely (fail closed).
            broken: { body: '<image href=x onerror=alert(5)>' },
          },
          aliases: { alias: { parent: 'safe' } },
        }),
      }),
    );

    const out = await fetchIconifyIconsBatch('https://api.iconify.design/', 'mdi', ['safe', 'evil', 'broken', 'alias', 'missing']);

    expect(fetch).toHaveBeenCalledWith('https://api.iconify.design/mdi.json?icons=safe%2Cevil%2Cbroken%2Calias%2Cmissing');
    expect(out['mdi:safe']).toContain('d="M1 1h22v22H1z"');
    expect(out['mdi:alias']).toBe(out['mdi:safe']);
    expect(out['mdi:evil']).toContain('d="M0 0"');
    expect(out['mdi:evil']).toContain('width="24"');
    expect(out['mdi:evil']).not.toMatch(/onload|onerror|script|foreignObject|alert/i);
    expect(out).not.toHaveProperty('mdi:broken');
    expect(out).not.toHaveProperty('mdi:missing');
  });
});

/** Iconify mode must survive a failing Iconify collection API (429, network error, CORS). */
describe('IconSelectorIconifyWidget fallback', () => {
  const config = {
    source: 'iconify',
    iconify_base: 'https://api.iconify.design',
    sets: [{ key: 'heroicons', label: 'Heroicons', prefixes: ['heroicons-outline'] }],
  };
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1h22v22H1z"/></svg>';

  /** Builds a container shaped like the form theme (hidden input + picker still marked aria-hidden). */
  function setup(): { container: HTMLElement; input: HTMLInputElement; picker: HTMLElement } {
    const container = document.createElement('div');
    container.setAttribute('data-controller', 'icon-selector');
    container.setAttribute(ATTR_EMPTY_TEXT, 'Sin iconos');
    const input = document.createElement('input');
    input.type = 'hidden';
    const picker = document.createElement('div');
    picker.setAttribute('aria-hidden', 'true');
    container.append(input, picker);
    document.body.appendChild(container);
    return { container, input, picker };
  }

  /** Routes fetch calls by URL; unknown URLs reject like a network/CORS failure. */
  function routeFetch(routes: Record<string, () => Promise<unknown>>): void {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        for (const [needle, respond] of Object.entries(routes)) {
          if (String(url).includes(needle)) return respond();
        }
        return Promise.reject(new TypeError('Failed to fetch'));
      }),
    );
  }

  const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('falls back to the bundle icon list when /collection is rate limited and still renders the trigger', async () => {
    routeFetch({
      '/api/icon-selector/config': () => json(config),
      '/collection': () => json({ error: 'Too Many Requests' }, 429),
      '/api/icon-selector/icons/svg': () => json({}),
      '/api/icon-selector/icons': () => json({ icons_by_set: { heroicons: ['heroicons-outline:home', 'heroicons-outline:user'] } }),
      'heroicons-outline.json': () => json({ width: 24, height: 24, icons: { home: { body: '<path d="M1 1h22v22H1z"/>' }, user: { body: '<path d="M2 2h20v20H2z"/>' } } }),
    });
    const { input, picker } = setup();
    const onReady = vi.fn();

    new IconSelectorIconifyWidget(picker.parentElement as HTMLElement, input, picker, '/api/icon-selector/config', undefined, onReady);

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/icon-selector/icons');
    expect(picker.hasAttribute('aria-hidden')).toBe(false);
    const trigger = picker.querySelector<HTMLElement>('.icon-selector-trigger');
    expect(trigger).not.toBeNull();
    expect(trigger!.hasAttribute('data-icon-selector-state')).toBe(false);
    trigger!.click();
    await vi.waitFor(() => {
      const items = picker.querySelectorAll<HTMLElement>('.icon-selector-item');
      expect(Array.from(items).map((b) => b.dataset.iconId)).toEqual(['heroicons-outline:home', 'heroicons-outline:user']);
      expect(items[0].querySelector('path')?.getAttribute('d')).toBe('M1 1h22v22H1z');
    });
  });

  it('loads SVGs from the bundle endpoint when the Iconify icon API is unreachable too', async () => {
    routeFetch({
      '/api/icon-selector/config': () => json(config),
      '/api/icon-selector/icons/svg': () => json({ 'heroicons-outline:home': svg.replace('<path', '<path onclick="alert(1)"') }),
      '/api/icon-selector/icons': () => json({ icons: ['heroicons-outline:home', 'not-an-id'] }),
    });
    const { input, picker } = setup();
    const onReady = vi.fn();

    new IconSelectorIconifyWidget(picker.parentElement as HTMLElement, input, picker, '/api/icon-selector/config', undefined, onReady, '/api/icon-selector/icons');

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    picker.querySelector<HTMLElement>('.icon-selector-trigger')!.click();
    await vi.waitFor(() => {
      const items = picker.querySelectorAll<HTMLElement>('.icon-selector-item');
      expect(items).toHaveLength(1);
      const wrap = items[0].querySelector('.icon-selector-svg-wrap') as HTMLElement;
      expect(wrap.classList.contains('icon-selector-svg-placeholder')).toBe(false);
      expect(wrap.innerHTML).toContain('M1 1h22v22H1z');
      expect(wrap.innerHTML).not.toContain('onclick');
    });
  });

  it('renders the trigger with an empty state when neither Iconify nor the bundle list can be loaded', async () => {
    routeFetch({
      '/api/icon-selector/config': () => json(config),
      '/api/icon-selector/icons': () => json({}, 500),
    });
    const { input, picker } = setup();
    const onReady = vi.fn();

    new IconSelectorIconifyWidget(picker.parentElement as HTMLElement, input, picker, '/api/icon-selector/config', undefined, onReady);

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(picker.hasAttribute('aria-hidden')).toBe(false);
    const trigger = picker.querySelector<HTMLElement>('.icon-selector-trigger');
    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute('data-icon-selector-state')).toBe('empty');
    trigger!.click();
    const panel = picker.querySelector<HTMLElement>('.icon-selector-panel')!;
    expect(panel.style.display).toBe('block');
    const empty = panel.querySelector('[role="status"]');
    expect(empty?.textContent).toBe('Sin iconos');
    expect(panel.querySelectorAll('.icon-selector-item')).toHaveLength(0);
  });

  it('renders the empty state when the config endpoint itself fails', async () => {
    routeFetch({});
    const { input, picker } = setup();
    const onReady = vi.fn();

    new IconSelectorIconifyWidget(picker.parentElement as HTMLElement, input, picker, '/api/icon-selector/config', undefined, onReady);

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(picker.querySelector('.icon-selector-trigger')?.getAttribute('data-icon-selector-state')).toBe('empty');
  });
});

/** After setup the picker contains the interactive trigger: it must not stay aria-hidden. */
describe('IconSelectorWidget accessibility', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('removes aria-hidden from the picker once the trigger is rendered', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ icons: ['bi:house'] }) }));
    const container = document.createElement('div');
    const input = document.createElement('input');
    const picker = document.createElement('div');
    picker.setAttribute('aria-hidden', 'true');
    container.append(input, picker);
    const onReady = vi.fn();

    new IconSelectorWidget(container, input, picker, '/api/icons', 'direct', undefined, onReady);

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(picker.querySelector('.icon-selector-trigger')).not.toBeNull();
    expect(picker.hasAttribute('aria-hidden')).toBe(false);
  });
});

describe('icon prefix restriction', () => {
  it('parses prefixes from attributes and config URL fragments', async () => {
    const lib = await import('./icon-selector-lib');
    expect(lib.parsePrefixes(null)).toBeNull();
    expect(lib.parsePrefixes(' tabler, BAD ,bi')).toEqual(['tabler', 'bi']);
    expect(lib.parsePrefixes('!!')).toBeNull();
    expect(lib.prefixesFromConfigUrl('/api/icon-selector/config#prefixes=tabler%2Cbi')).toEqual(['tabler', 'bi']);
    expect(lib.prefixesFromConfigUrl('/api/icon-selector/config')).toBeNull();
    expect(lib.iconAllowedByPrefixes('tabler:home', ['tabler'])).toBe(true);
    expect(lib.iconAllowedByPrefixes('bi:house', ['tabler'])).toBe(false);
    expect(lib.iconAllowedByPrefixes('bi:house', null)).toBe(true);
  });

  it('restricts config sets and adds sets for unlisted prefixes', async () => {
    const lib = await import('./icon-selector-lib');
    const config = {
      iconify_base: 'https://api.iconify.design',
      sets: [
        { key: 'heroicons', label: 'Heroicons', prefixes: ['heroicons-outline', 'heroicons-solid'] },
        { key: 'bootstrap-icons', label: 'Bootstrap', prefixes: ['bi'] },
      ],
    };
    expect(lib.restrictConfigToPrefixes(config, null)).toBe(config);
    expect(lib.restrictConfigToPrefixes(null, ['bi'])).toBeNull();
    expect(lib.restrictConfigToPrefixes(config, ['heroicons-outline', 'tabler'])!.sets).toEqual([
      { key: 'heroicons', label: 'Heroicons', prefixes: ['heroicons-outline'] },
      { key: 'tabler', label: 'tabler', prefixes: ['tabler'] },
    ]);
  });

  it('fetchIconifyConfig never sends the fragment and applies it', async () => {
    const lib = await import('./icon-selector-lib');
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ iconify_base: 'x', sets: [{ key: 'bootstrap-icons', label: 'B', prefixes: ['bi'] }] }),
    }));
    vi.stubGlobal('fetch', fetchFn);
    const config = await lib.fetchIconifyConfig('/api/icon-selector/config#prefixes=tabler');
    expect(fetchFn).toHaveBeenCalledWith('/api/icon-selector/config');
    expect(config!.sets).toEqual([{ key: 'tabler', label: 'tabler', prefixes: ['tabler'] }]);
    vi.unstubAllGlobals();
  });
});

describe('Tom Select initial value (audit RO-2)', () => {
  it('never asks Iconify for emoji values or ids outside the prefix restriction', async () => {
    const lib = await import('./icon-selector-lib');
    expect(lib.shouldFetchIconSvg('emoji:🚀', '/api/icon-selector/config')).toBe(false);
    expect(lib.shouldFetchIconSvg('tabler:home', '/api/icon-selector/config')).toBe(true);
    expect(lib.shouldFetchIconSvg('tabler:home', '/api/icon-selector/config#prefixes=tabler')).toBe(true);
    expect(lib.shouldFetchIconSvg('bi:house', '/api/icon-selector/config#prefixes=tabler')).toBe(false);
    expect(lib.shouldFetchIconSvg('home', undefined)).toBe(false);
    expect(lib.shouldFetchIconSvg('', undefined)).toBe(false);
    expect(lib.shouldFetchIconSvg(null, undefined)).toBe(false);
  });

  it('keeps a stored icon id that is no longer offered as a Tom Select option (audit SA-L5)', async () => {
    const lib = await import('./icon-selector-lib');
    const base = [{ value: 'tabler:home', text: 'home', svg: '' }];
    expect(lib.withStoredValueOption(base, 'tabler:gone')).toEqual([...base, { value: 'tabler:gone', text: 'gone', svg: '' }]);
    expect(lib.withStoredValueOption(base, 'tabler:home')).toBe(base);
    expect(lib.withStoredValueOption(base, '')).toBe(base);
    expect(lib.withStoredValueOption(base, 'plain')).toBe(base);
    expect(lib.withStoredValueOption(base, 'emoji:🚀')).toEqual([...base, { value: 'emoji:🚀', text: '🚀', svg: '' }]);
  });

  it('keeps a stored emoji as a Tom Select option (audit RO-1)', async () => {
    const lib = await import('./icon-selector-lib');
    const base = [{ value: 'tabler:home', text: 'home', svg: '' }];
    expect(lib.withStoredEmojiOption(base, 'emoji:🚀')).toEqual([...base, { value: 'emoji:🚀', text: '🚀', svg: '' }]);
    expect(lib.withStoredEmojiOption(base, 'tabler:home')).toBe(base);
    expect(lib.withStoredEmojiOption(base, 'emoji:')).toBe(base);
    const withEmoji = [{ value: 'emoji:🚀', text: '🚀', svg: '' }];
    expect(lib.withStoredEmojiOption(withEmoji, 'emoji:🚀')).toBe(withEmoji);
  });
});

/**
 * Strict CSP / privacy (Beacon report): with source bundle or ux_icons_local the browser must never contact
 * api.iconify.design or any other third party; only same-origin bundle endpoints are fetched.
 */
describe('same-origin icon sources', () => {
  const sets = [{ key: 'tabler', label: 'Tabler', prefixes: ['tabler'] }];
  const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });

  /** Records every fetched URL; answers the bundle endpoints, rejects anything else. */
  function stubFetch(config: unknown): string[] {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        urls.push(String(url));
        if (String(url).startsWith('/api/icon-selector/config')) return json(config);
        if (String(url).startsWith('/api/icon-selector/icons/svg')) {
          // UX Icons renders local icons without xmlns.
          return json({ 'tabler:home': '<svg viewBox="0 0 24 24" class="icon-selector-svg"><path d="M1 1h22v22H1z"/></svg>' });
        }
        if (String(url).startsWith('/api/icon-selector/icons')) return json({ icons_by_set: { tabler: ['tabler:home', 'tabler:star'] } });
        return Promise.reject(new TypeError('blocked by test: ' + String(url)));
      }),
    );
    return urls;
  }

  function setup(): { container: HTMLElement; input: HTMLInputElement; picker: HTMLElement } {
    const container = document.createElement('div');
    container.setAttribute('data-controller', 'icon-selector');
    const input = document.createElement('input');
    input.type = 'hidden';
    const picker = document.createElement('div');
    container.append(input, picker);
    document.body.appendChild(container);
    return { container, input, picker };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('withSvgNamespace adds xmlns only to a root svg without it', async () => {
    const lib = await import('./icon-selector-lib');
    expect(lib.withSvgNamespace('<svg viewBox="0 0 1 1"></svg>')).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>');
    expect(lib.withSvgNamespace('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(lib.withSvgNamespace('<div></div>')).toBe('<div></div>');
  });

  it('usesBrowserIconify only accepts source iconify with a base URL', async () => {
    const lib = await import('./icon-selector-lib');
    expect(lib.usesBrowserIconify({ source: 'iconify', iconify_base: 'https://api.iconify.design', sets })).toBe(true);
    expect(lib.usesBrowserIconify({ source: 'iconify', iconify_base: '', sets })).toBe(false);
    expect(lib.usesBrowserIconify({ source: 'iconify', iconify_base: null, sets })).toBe(false);
    expect(lib.usesBrowserIconify({ source: 'bundle', iconify_base: 'https://api.iconify.design', sets })).toBe(false);
    expect(lib.usesBrowserIconify({ source: 'ux_icons_local', iconify_base: null, sets })).toBe(false);
    // A 1.6-shaped config (no source) never enables third-party requests.
    expect(lib.usesBrowserIconify({ iconify_base: 'https://api.iconify.design', sets })).toBe(false);
    expect(lib.usesBrowserIconify(null)).toBe(false);
    expect(lib.usesBrowserIconify(undefined)).toBe(false);
  });

  for (const source of ['bundle', 'ux_icons_local']) {
    it(`grid widget with source ${source} only fetches same-origin bundle endpoints`, async () => {
      const urls = stubFetch({ source, iconify_base: null, sets, debug: false });
      const { container, input, picker } = setup();
      input.value = 'tabler:home';
      const onReady = vi.fn();

      new IconSelectorIconifyWidget(container, input, picker, '/api/icon-selector/config', undefined, onReady, '/api/icon-selector/icons');

      await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
      picker.querySelector<HTMLElement>('.icon-selector-trigger')!.click();
      await vi.waitFor(() => {
        const items = picker.querySelectorAll<HTMLElement>('.icon-selector-item');
        expect(Array.from(items).map((b) => b.dataset.iconId)).toEqual(['tabler:home', 'tabler:star']);
        expect(items[0].innerHTML).toContain('M1 1h22v22H1z');
      });
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(url.startsWith('/api/icon-selector/')).toBe(true);
      }
      expect(urls.some((u) => u.includes('/collection'))).toBe(false);
    });
  }

  it('ignores an Iconify base URL when the config has no source (host provider written for 1.6)', async () => {
    const urls = stubFetch({ iconify_base: 'https://api.iconify.design', sets });
    const { container, input, picker } = setup();
    const onReady = vi.fn();

    new IconSelectorIconifyWidget(container, input, picker, '/api/icon-selector/config', undefined, onReady, '/api/icon-selector/icons');

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(urls.every((u) => u.startsWith('/api/icon-selector/'))).toBe(true);
  });

  it('search and SVG helpers never call Iconify with a same-origin source', async () => {
    const lib = await import('./icon-selector-lib');
    const urls = stubFetch({ source: 'bundle', iconify_base: null, sets });
    expect(await lib.fetchIconifySearch('/api/icon-selector/config', 'home')).toEqual([]);
    expect(await lib.fetchIconifySvgsForIds('/api/icon-selector/config', ['tabler:home'])).toEqual({});
    expect(urls.every((u) => u.startsWith('/api/icon-selector/config'))).toBe(true);
  });

  it('tom_select with a same-origin source uses the bundle list, not the Iconify on-demand search', async () => {
    const urls = stubFetch({ source: 'ux_icons_local', iconify_base: null, sets });
    const select = document.createElement('select');
    document.body.appendChild(select);
    const lib = await import('./icon-selector-lib');

    await lib.initTomSelect(select, '/api/icon-selector/icons', null, '/api/icon-selector/config');

    expect(urls).toContain('/api/icon-selector/icons');
    expect(urls.every((u) => u.startsWith('/api/icon-selector/'))).toBe(true);
  });

  it('Tom Select option markup carries no style attribute (strict CSP)', async () => {
    const lib = await import('./icon-selector-lib');
    const TomSelect = (await import('tom-select')).default as unknown as ReturnType<typeof vi.fn>;
    TomSelect.mockClear();
    stubFetch({ source: 'bundle', iconify_base: null, sets });
    const select = document.createElement('select');
    document.body.appendChild(select);

    await lib.initTomSelect(select, '/api/icon-selector/icons', null, '/api/icon-selector/config');

    const options = TomSelect.mock.calls[0][1] as { render: { option: (d: unknown) => string; item: (d: unknown) => string } };
    for (const html of [
      options.render.option({ value: 'tabler:home', text: 'home', svg: '<svg></svg>' }),
      options.render.option({ value: 'tabler:home', text: 'home', svg: '' }),
      options.render.item({ value: 'tabler:home', text: 'home', svg: '<svg></svg>' }),
      options.render.item({ value: 'tabler:home', text: 'home' }),
    ]) {
      expect(html).not.toMatch(/style=/);
    }
  });
});
