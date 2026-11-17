/**
 * 1.8 (Beacon / WikiBundle feedback): widget theme classes, translated texts from the server, no inline styles,
 * and the form-ready guard with a submit button outside the form.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { FORM_READY_TIMEOUT_MS, IconSelectorWidget, IconSelectorIconifyWidget, initIconSelectorContainer } from './icon-selector-lib';
import { attachEmojiPicker } from './emoji-picker';
import { ATTR_LABELS, ATTR_THEME, DEFAULT_LABELS, labelsOf, partClass, themeOf } from './widget-theme';

vi.mock('tom-select', () => ({
  default: vi.fn().mockImplementation(function () {
    return { destroy: vi.fn() };
  }),
}));

const BOOTSTRAP_CLASS = /\b(form-control|form-select|btn|bg-white|border|rounded|shadow-sm|d-flex|d-inline-flex|mb-2|mt-2|p-2|text-muted|small)\b/;

const LABELS = {
  placeholder: 'Elegir icono...',
  search_placeholder: 'Buscar iconos...',
  empty: 'No hay iconos disponibles.',
  all: 'Todos',
  category: 'Categoría:',
  sets: 'Conjuntos de iconos',
  categories: 'Categorías',
};

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });

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

function container(theme?: 'uikit' | 'bootstrap', labels: object | null = LABELS): { container: HTMLElement; input: HTMLInputElement; picker: HTMLElement } {
  const c = document.createElement('div');
  c.className = 'icon-selector-widget';
  c.setAttribute('data-controller', 'icon-selector');
  if (theme) c.setAttribute(ATTR_THEME, theme);
  if (labels) c.setAttribute(ATTR_LABELS, JSON.stringify(labels));
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'icon';
  input.setAttribute('data-icon-selector-target', 'input');
  const picker = document.createElement('div');
  picker.className = 'icon-selector-picker';
  picker.setAttribute('data-icon-selector-target', 'picker');
  c.append(input, picker);
  document.body.appendChild(c);
  return { container: c, input, picker };
}

/** Every element with a class inside root, as one space-separated string per element. */
function classesIn(root: Element): string[] {
  return Array.from(root.querySelectorAll('[class]')).map((el) => el.getAttribute('class') ?? '');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('widget theme helpers', () => {
  it('themeOf defaults to bootstrap (1.7 markup) and reads uikit', () => {
    const el = document.createElement('div');
    expect(themeOf(el)).toBe('bootstrap');
    expect(themeOf(null)).toBe('bootstrap');
    el.setAttribute(ATTR_THEME, 'uikit');
    expect(themeOf(el)).toBe('uikit');
    el.setAttribute(ATTR_THEME, 'other');
    expect(themeOf(el)).toBe('bootstrap');
  });

  it('partClass adds the Bootstrap classes only with the bootstrap theme', () => {
    expect(partClass('uikit', 'panel')).toBe('icon-selector-panel');
    expect(partClass('bootstrap', 'panel')).toBe('icon-selector-panel border rounded shadow-sm p-2 bg-white');
    expect(partClass('uikit', 'pickerWidget', 'icon-selector-iconify-widget')).toBe('icon-selector-picker-widget icon-selector-iconify-widget');
    expect(partClass('uikit', 'gridContainer')).toBe('icon-selector-grid-container');
  });

  it('labelsOf reads the JSON labels, then the 1.7 attributes, then English', () => {
    const el = document.createElement('div');
    expect(labelsOf(el)).toEqual(DEFAULT_LABELS);
    el.setAttribute('data-icon-selector-search-placeholder', 'Buscar');
    el.setAttribute('data-icon-selector-empty-text', 'Vacío');
    // Without the labels JSON (1.7 markup) the trigger shows the search placeholder, as before.
    expect(labelsOf(el)).toMatchObject({ placeholder: 'Buscar', search_placeholder: 'Buscar', empty: 'Vacío', all: 'All' });
    el.setAttribute(ATTR_LABELS, JSON.stringify({ placeholder: 'Elegir', all: 'Todos', category: 42 }));
    expect(labelsOf(el)).toMatchObject({ placeholder: 'Elegir', search_placeholder: 'Buscar', all: 'Todos', category: 'Category:' });
    expect(labelsOf(el, 'Explícito').search_placeholder).toBe('Explícito');
    el.setAttribute(ATTR_LABELS, '{not json');
    expect(labelsOf(el).all).toBe('All');
  });
});

describe('UiKit theme: no Bootstrap classes, no inline styles, translated texts', () => {
  it('legacy widget (search mode)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ icons: ['tabler:home', 'tabler:robot'] }) })
      .mockResolvedValue({ ok: true, json: async () => ({ 'tabler:home': '<svg><path d="M1 1"/></svg>', 'tabler:robot': '<svg><path d="M2 2"/></svg>' }) }));
    const { container: c, input, picker } = container('uikit');
    const onReady = vi.fn();
    new IconSelectorWidget(c, input, picker, '/api/icons', 'search', undefined, onReady);
    await vi.waitFor(() => expect(onReady).toHaveBeenCalled());

    const trigger = picker.querySelector<HTMLButtonElement>('.icon-selector-trigger')!;
    expect(trigger.textContent).toBe('Elegir icono...');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(picker.classList.contains('icon-selector-picker-widget')).toBe(true);
    expect(picker.classList.contains('icon-selector-widget-dropdown')).toBe(true);
    const search = picker.querySelector<HTMLInputElement>('.icon-selector-search')!;
    expect(search.placeholder).toBe('Buscar iconos...');
    expect(search.getAttribute('aria-label')).toBe('Buscar iconos...');

    trigger.click();
    const panel = picker.querySelector<HTMLElement>('.icon-selector-panel')!;
    await vi.waitFor(() => expect(picker.querySelectorAll('.icon-selector-item')).toHaveLength(2));
    expect(panel.hidden).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    search.value = 'robot';
    search.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(picker.querySelectorAll('.icon-selector-item')).toHaveLength(1));
    const robot = picker.querySelector<HTMLButtonElement>('.icon-selector-item[data-icon-id="tabler:robot"]')!;
    const changed = vi.fn();
    input.addEventListener('change', changed);
    robot.click();
    expect(input.value).toBe('tabler:robot');
    expect(changed).toHaveBeenCalled();
    expect(panel.hidden).toBe(true);
    expect(robot.getAttribute('aria-pressed')).toBe('true');

    for (const cls of classesIn(c)) expect(cls).not.toMatch(BOOTSTRAP_CLASS);
    expect(c.querySelectorAll('[style]')).toHaveLength(0);
  });

  it('Iconify-shaped widget (same-origin source) with set and category filters', async () => {
    routeFetch({
      '/api/icon-selector/config': () => json({ source: 'ux_icons_local', iconify_base: null, sets: [{ key: 'tabler', label: 'Tabler', prefixes: ['tabler'] }, { key: 'bootstrap-icons', label: 'Bootstrap', prefixes: ['bi'] }] }),
      '/api/icon-selector/icons/svg': () => json({ 'tabler:home': '<svg><path d="M1 1"/></svg>' }),
      '/api/icon-selector/icons': () => json({ icons: ['tabler:home', 'bi:house'] }),
    });
    const { container: c, input, picker } = container('uikit');
    const onReady = vi.fn();
    new IconSelectorIconifyWidget(c, input, picker, '/api/icon-selector/config', undefined, onReady);
    await vi.waitFor(() => expect(onReady).toHaveBeenCalled());

    // Neutral class plus the 1.7 alias.
    expect(picker.classList.contains('icon-selector-picker-widget')).toBe(true);
    expect(picker.classList.contains('icon-selector-iconify-widget')).toBe(true);
    // Lazy load: the grid is empty until the panel is opened.
    expect(picker.querySelectorAll('.icon-selector-item')).toHaveLength(0);
    const filters = picker.querySelector('.icon-selector-set-filters')!;
    expect(filters.getAttribute('aria-label')).toBe('Conjuntos de iconos');
    expect(filters.querySelector('button')!.textContent).toBe('Todos');

    picker.querySelector<HTMLButtonElement>('.icon-selector-trigger')!.click();
    await vi.waitFor(() => expect(picker.querySelectorAll('.icon-selector-item')).toHaveLength(2));
    picker.querySelector<HTMLButtonElement>('.icon-selector-item[data-icon-id="tabler:home"]')!.click();
    expect(input.value).toBe('tabler:home');

    for (const cls of classesIn(c)) expect(cls).not.toMatch(BOOTSTRAP_CLASS);
    expect(c.querySelectorAll('[style]')).toHaveLength(0);
  });

  it('Escape closes the panel and gives the focus back to the trigger', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ icons: [] }) }));
    const { container: c, input, picker } = container('uikit');
    const onReady = vi.fn();
    new IconSelectorWidget(c, input, picker, '/api/icons', 'direct', undefined, onReady);
    await vi.waitFor(() => expect(onReady).toHaveBeenCalled());
    const trigger = picker.querySelector<HTMLButtonElement>('.icon-selector-trigger')!;
    trigger.click();
    const panel = picker.querySelector<HTMLElement>('.icon-selector-panel')!;
    expect(panel.hidden).toBe(false);
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('emoji tab: classes and state attributes only, the icons part hidden with the hidden attribute', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ emoji_version: '18.0', groups: ['Smileys'], emoji: [['🤖', 'robot', 'bot', 0, 1]] }) }));
    const { container: c } = container('uikit');
    c.setAttribute('data-icon-selector-emoji-value', '1');
    c.setAttribute('data-icon-selector-emoji-url-value', '/emoji.json');
    const dispose = attachEmojiPicker(c)!;
    c.querySelector<HTMLButtonElement>('.icon-selector-emoji-tab-emoji')!.click();
    await vi.waitFor(() => expect(c.querySelectorAll('.icon-selector-emoji-item')).toHaveLength(1));
    expect(c.querySelector('.icon-selector-picker')!.hasAttribute('hidden')).toBe(true);
    expect(c.querySelector('.icon-selector-emoji-tab-emoji')!.getAttribute('aria-selected')).toBe('true');
    c.querySelector<HTMLButtonElement>('.icon-selector-emoji-item')!.click();
    expect(c.querySelector('.icon-selector-emoji-item')!.getAttribute('aria-pressed')).toBe('true');
    expect(c.querySelector<HTMLSelectElement>('.icon-selector-emoji-group')!.className).toBe('icon-selector-emoji-control icon-selector-emoji-group');
    for (const cls of classesIn(c)) expect(cls).not.toMatch(BOOTSTRAP_CLASS);
    expect(c.querySelectorAll('[style]')).toHaveLength(0);
    c.querySelector<HTMLButtonElement>('.icon-selector-emoji-tab-icons')!.click();
    expect(c.querySelector('.icon-selector-picker')!.hasAttribute('hidden')).toBe(false);
    dispose();
  });
});

describe('Bootstrap theme keeps the 1.7 classes (no inline styles)', () => {
  it('legacy widget', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ icons: ['bi:house'] }) })
      .mockResolvedValue({ ok: true, json: async () => ({ 'bi:house': '<svg></svg>' }) }));
    const { container: c, input, picker } = container('bootstrap', null);
    c.setAttribute('data-icon-selector-search-placeholder', 'Search icons...');
    const onReady = vi.fn();
    new IconSelectorWidget(c, input, picker, '/api/icons', 'search', undefined, onReady);
    await vi.waitFor(() => expect(onReady).toHaveBeenCalled());
    const trigger = picker.querySelector('.icon-selector-trigger')!;
    expect(trigger.className).toBe('icon-selector-trigger form-control form-control-sm d-flex align-items-center gap-2 text-start');
    expect(trigger.textContent).toBe('Search icons...');
    expect(picker.querySelector('.icon-selector-panel')!.className).toBe('icon-selector-panel border rounded shadow-sm p-2 bg-white');
    (trigger as HTMLElement).click();
    await vi.waitFor(() => expect(picker.querySelectorAll('.icon-selector-item')).toHaveLength(1));
    expect(picker.querySelector('.icon-selector-item')!.className).toContain('btn btn-sm btn-outline-secondary');
    expect(c.querySelectorAll('[style]')).toHaveLength(0);
  });
});

describe('form-ready guard (Beacon: Save outside the form)', () => {
  function formWithExternalSave(): { form: HTMLFormElement; inner: HTMLButtonElement; outer: HTMLButtonElement; widget: HTMLElement } {
    document.body.innerHTML = '';
    const form = document.createElement('form');
    form.id = 'page-form';
    const { container: c } = container('uikit');
    form.appendChild(c);
    const inner = document.createElement('button');
    inner.type = 'submit';
    form.appendChild(inner);
    const outer = document.createElement('button');
    outer.type = 'submit';
    outer.setAttribute('form', 'page-form');
    document.body.append(outer, form);
    return { form, inner, outer, widget: c };
  }

  it('disables the outer submit button too, holds a submit and replays it once the widget is ready', async () => {
    let releaseConfig: (v: unknown) => void = () => {};
    routeFetch({
      '/config': () => new Promise((resolve) => { releaseConfig = resolve; }),
      '/icons': () => json({ icons: [] }),
    });
    const { form, inner, outer, widget } = formWithExternalSave();
    widget.setAttribute('data-icon-selector-config-url-value', '/config');
    widget.setAttribute('data-icon-selector-icons-url-value', '/icons');
    const submits: (Element | null)[] = [];
    form.addEventListener('submit', (e) => {
      submits.push((e as SubmitEvent).submitter ?? null);
      e.preventDefault();
    });

    initIconSelectorContainer(widget);
    expect(inner.disabled).toBe(true);
    expect(outer.disabled).toBe(true);

    // A submit that still happens while loading (Enter in a field, a script) is held, not lost.
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(submits).toHaveLength(0);

    releaseConfig({ ok: true, json: async () => ({ sets: [] }) });
    await vi.waitFor(() => expect(widget.getAttribute('data-icon-selector-ready')).toBe('1'));
    expect(inner.disabled).toBe(false);
    expect(outer.disabled).toBe(false);
    await vi.waitFor(() => expect(submits).toHaveLength(1));
  });

  it('a widget that never gets ready stops holding the form after the timeout', async () => {
    vi.useFakeTimers();
    routeFetch({ '/config': () => new Promise(() => {}) });
    const { outer, widget } = formWithExternalSave();
    widget.setAttribute('data-icon-selector-config-url-value', '/config');
    initIconSelectorContainer(widget);
    expect(outer.disabled).toBe(true);
    vi.advanceTimersByTime(FORM_READY_TIMEOUT_MS + 1);
    expect(outer.disabled).toBe(false);
    expect(widget.getAttribute('data-icon-selector-ready')).toBe('1');
  });

  it('an icon list that cannot be loaded releases the form at once', async () => {
    routeFetch({
      '/config': () => json({ sets: [] }),
      '/icons': () => Promise.reject(new TypeError('offline')),
    });
    const { outer, widget } = formWithExternalSave();
    widget.setAttribute('data-icon-selector-config-url-value', '/config');
    widget.setAttribute('data-icon-selector-icons-url-value', '/icons');
    initIconSelectorContainer(widget);
    await vi.waitFor(() => expect(widget.getAttribute('data-icon-selector-ready')).toBe('1'));
    expect(outer.disabled).toBe(false);
  });

  it('with two widgets the buttons come back when both are ready', async () => {
    const releases: ((v: unknown) => void)[] = [];
    routeFetch({
      '/config': () => new Promise((resolve) => releases.push(resolve)),
      '/icons': () => json({ icons: [] }),
    });
    const { form, outer, widget } = formWithExternalSave();
    const second = container('uikit').container;
    form.appendChild(second);
    for (const w of [widget, second]) {
      w.setAttribute('data-icon-selector-config-url-value', '/config');
      w.setAttribute('data-icon-selector-icons-url-value', '/icons');
      initIconSelectorContainer(w);
    }
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    releases[0]({ ok: true, json: async () => ({ sets: [] }) });
    await vi.waitFor(() => expect(document.querySelectorAll('[data-icon-selector-ready="1"]')).toHaveLength(1));
    expect(outer.disabled).toBe(true);
    releases[1]({ ok: true, json: async () => ({ sets: [] }) });
    await vi.waitFor(() => expect(outer.disabled).toBe(false));
  });
});

describe('search while the first page of SVGs is still loading (Wiki demo race)', () => {
  it('the older render does not overwrite the search result', async () => {
    let releaseFirst: () => void = () => {};
    let svgCalls = 0;
    routeFetch({
      '/api/icon-selector/config': () => json({ source: 'ux_icons_local', iconify_base: null, sets: [{ key: 'bootstrap-icons', label: 'Bootstrap', prefixes: ['bi'] }] }),
      '/api/icon-selector/icons/svg': () => {
        svgCalls++;
        const body = { 'bi:robot': '<svg><path d="M1 1"/></svg>', 'bi:house': '<svg><path d="M2 2"/></svg>' };
        // The first (unfiltered) batch answers after the search batch.
        return svgCalls === 1 ? new Promise((resolve) => { releaseFirst = () => resolve({ ok: true, json: async () => body }); }) : json(body);
      },
      '/api/icon-selector/icons': () => json({ icons: ['bi:house', 'bi:robot'] }),
    });
    const { container: c, input, picker } = container('uikit');
    const onReady = vi.fn();
    new IconSelectorIconifyWidget(c, input, picker, '/api/icon-selector/config', undefined, onReady);
    await vi.waitFor(() => expect(onReady).toHaveBeenCalled());
    picker.querySelector<HTMLButtonElement>('.icon-selector-trigger')!.click();
    const search = picker.querySelector<HTMLInputElement>('.icon-selector-panel-search')!;
    search.value = 'robot';
    search.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(picker.querySelectorAll('.icon-selector-item')).toHaveLength(1));
    releaseFirst();
    await new Promise((r) => setTimeout(r, 20));
    expect(Array.from(picker.querySelectorAll<HTMLElement>('.icon-selector-item')).map((b) => b.dataset.iconId)).toEqual(['bi:robot']);
  });
});
