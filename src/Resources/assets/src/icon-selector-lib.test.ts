/**
 * Unit tests for the icon selector library: getOptionsFromScript, IconSelectorWidget, and runInit.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getOptionsFromScript,
  IconSelectorWidget,
  runInit,
  ATTR_MODE,
  ATTR_URL,
  ATTR_SEARCH_PLACEHOLDER,
} from './icon-selector-lib';

/** Mock TomSelect to avoid DOM/constructor side effects in initTomSelect tests. */
vi.mock('tom-select', () => ({
  default: vi.fn().mockImplementation(() => ({ destroy: vi.fn() })),
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
    script.textContent = 'not json {';
    document.body.appendChild(script);
    expect(getOptionsFromScript('bad')).toBeNull();
  });

  it('returns null when script content is not an array', () => {
    const script = document.createElement('script');
    script.id = 'icon-selector-options-obj';
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
        json: async () => ({ icons: ['heroicons-outline:home', 'bi:house'] }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          'heroicons-outline:home': '<svg>home</svg>',
          'bi:house': '<svg>house</svg>',
        }),
      });
    new IconSelectorWidget(container, input, picker, '/api/icons', 'direct');
    await vi.waitFor(() => picker.querySelector('.icon-selector-trigger'));
    const trigger = picker.querySelector<HTMLElement>('.icon-selector-trigger');
    expect(trigger).not.toBeNull();
    trigger!.click();
    await vi.waitFor(() => {
      const buttons = picker.querySelectorAll('.icon-selector-item');
      expect(buttons.length).toBe(2);
      expect(buttons[0].getAttribute('data-icon-id')).toBe('heroicons-outline:home');
      expect(buttons[0].querySelector('.icon-selector-svg-wrap')?.innerHTML).toBe('<svg>home</svg>');
      expect(buttons[1].getAttribute('data-icon-id')).toBe('bi:house');
      expect(buttons[1].querySelector('.icon-selector-svg-wrap')?.innerHTML).toBe('<svg>house</svg>');
    });
  });

  it('uses icons_by_set when icons array is missing', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        json: async () => ({
          icons_by_set: {
            heroicons: ['heroicons-outline:home'],
          },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ 'heroicons-outline:home': '<svg></svg>' }),
      });
    new IconSelectorWidget(container, input, picker, '/api/icons', 'direct');
    await vi.waitFor(() => picker.querySelector('.icon-selector-trigger'));
    picker.querySelector<HTMLElement>('.icon-selector-trigger')!.click();
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
});
