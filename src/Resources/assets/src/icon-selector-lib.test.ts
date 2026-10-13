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
