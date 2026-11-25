/**
 * Turbo Drive hooks (1.9.2, audits ZBC-D-I3 / ZBM-L1 / ZBM-L2 / ZBM-I3), in their own file so the module starts fresh:
 * only the Stimulus path (initIconSelectorContainer) runs here, never runInitAndObserve().
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initIconSelectorContainer } from './icon-selector-lib';

vi.mock('tom-select', () => ({
  default: vi.fn().mockImplementation(function () {
    return { destroy: vi.fn() };
  }),
}));

function make(): HTMLElement {
  const container = document.createElement('div');
  container.setAttribute('data-controller', 'icon-selector');
  container.setAttribute('data-icon-selector-icons-url-value', '/api/icons');
  container.setAttribute('data-icon-selector-mode-value', 'direct');
  const input = document.createElement('input');
  input.setAttribute('data-icon-selector-target', 'input');
  input.className = 'icon-selector-input';
  const picker = document.createElement('div');
  picker.setAttribute('data-icon-selector-target', 'picker');
  picker.className = 'icon-selector-picker';
  container.append(input, picker);
  document.body.appendChild(container);
  return container;
}

const initialised = (c: HTMLElement): boolean => c.getAttribute('data-icon-selector-init') === '1';

describe('Turbo hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ icons: [] }) }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-turbo-preview');
    document.body.innerHTML = '';
  });

  it('a Turbo preview is not initialised, not even from a Stimulus connect() (ZBM-I3)', () => {
    const c = make();
    document.documentElement.setAttribute('data-turbo-preview', '');
    expect(initIconSelectorContainer(c)).toBe(false);
    expect(initialised(c)).toBe(false);
  });

  it('Stimulus-only hosts get the cache teardown too (ZBM-L2), and turbo:load / turbo:frame-load set the page up again (ZBM-L1)', () => {
    const c = make();
    const other = make();
    expect(typeof initIconSelectorContainer(c)).toBe('function');
    expect(initialised(c)).toBe(true);
    expect(initialised(other)).toBe(false);

    // Snapshot for the cache (or a frame navigation promoted to a visit: the page stays on screen).
    document.dispatchEvent(new Event('turbo:before-cache'));
    expect(initialised(c)).toBe(false);
    expect(c.hasAttribute('data-icon-selector-enhanced')).toBe(false);

    document.dispatchEvent(new Event('turbo:load'));
    expect(initialised(c)).toBe(true);
    expect(initialised(other)).toBe(true);
    // Idempotent: a second event does not set up the widgets twice.
    const fetchCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    document.dispatchEvent(new Event('turbo:load'));
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCalls);

    document.dispatchEvent(new Event('turbo:before-cache'));
    expect(initialised(c)).toBe(false);
    document.dispatchEvent(new Event('turbo:frame-load'));
    expect(initialised(c)).toBe(true);
    expect(initialised(other)).toBe(true);
  });
});
