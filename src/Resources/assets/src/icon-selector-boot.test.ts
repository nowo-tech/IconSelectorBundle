/**
 * REQ-ASSETS-005 once-guard of the entry script: a second copy of the script on the same page does not initialise
 * again (no second discovery pass, MutationObserver or API object) and logs no second "script loaded" line.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./icon-selector-lib', () => ({
  setBundleLogger: vi.fn(),
  runInitAndObserve: vi.fn(),
  runInit: vi.fn(),
  initIconSelectorContainer: vi.fn(),
}));

import { BOOT_FLAG } from './icon-selector-boot';
import { createBundleLogger } from './logger';

type Host = Record<string, unknown> & { NowoIconSelector?: unknown; __nowoScriptBanners?: unknown };

/** Loads a fresh copy of the boot module, like a second <script> tag evaluating the IIFE again. */
async function freshBoot(): Promise<typeof import('./icon-selector-boot')> {
  vi.resetModules();

  return import('./icon-selector-boot');
}

describe('bootIconSelector', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete (globalThis as Host)[BOOT_FLAG];
    delete (globalThis as Host).__nowoScriptBanners;
    delete (window as unknown as Host).NowoIconSelector;
    vi.clearAllMocks();
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as Host)[BOOT_FLAG];
    delete (globalThis as Host).__nowoScriptBanners;
    delete (window as unknown as Host).NowoIconSelector;
  });

  it('initialises once and logs once when the script is loaded twice', async () => {
    const first = await freshBoot();
    expect(first.bootIconSelector(createBundleLogger('icon-selector'))).toBe(true);
    const api = (window as unknown as Host).NowoIconSelector;

    const second = await freshBoot();
    expect(second.bootIconSelector(createBundleLogger('icon-selector'))).toBe(false);

    const mocked = vi.mocked(await import('./icon-selector-lib'));
    expect(mocked.runInitAndObserve).toHaveBeenCalledTimes(1);
    expect(mocked.setBundleLogger).toHaveBeenCalledTimes(1);
    expect((window as unknown as Host).NowoIconSelector).toBe(api);
    expect(consoleLog).toHaveBeenCalledTimes(1);
    expect(String(consoleLog.mock.calls[0]?.[0])).toContain('📦 [icon-selector] script loaded');
  });

  it('exposes the API on window.NowoIconSelector', async () => {
    const { bootIconSelector } = await freshBoot();
    bootIconSelector(createBundleLogger('icon-selector'));
    const mocked = vi.mocked(await import('./icon-selector-lib'));
    expect((window as unknown as Host).NowoIconSelector).toEqual({
      initIconSelectorContainer: mocked.initIconSelectorContainer,
      runInit: mocked.runInit,
      runInitAndObserve: mocked.runInitAndObserve,
    });
  });

  it('waits for DOMContentLoaded while the document is loading, once', async () => {
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const { bootIconSelector } = await freshBoot();
    bootIconSelector(createBundleLogger('icon-selector'));
    const mocked = vi.mocked(await import('./icon-selector-lib'));
    expect(mocked.runInitAndObserve).not.toHaveBeenCalled();

    readyState.mockRestore();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(mocked.runInitAndObserve).toHaveBeenCalledTimes(1);
  });

  it('falls back to a module flag when the page-wide flag cannot be written', async () => {
    Object.defineProperty(globalThis, BOOT_FLAG, { configurable: true, get: () => 'clobbered', set: () => undefined });
    try {
      const { claimBoot } = await freshBoot();
      expect(claimBoot()).toBe(true);
      expect(claimBoot()).toBe(false);
    } finally {
      delete (globalThis as Host)[BOOT_FLAG];
    }
  });

  it('never throws when the page-wide flag throws on write', async () => {
    Object.defineProperty(globalThis, BOOT_FLAG, {
      configurable: true,
      get: () => undefined,
      set: () => {
        throw new TypeError('read-only');
      },
    });
    try {
      const { claimBoot } = await freshBoot();
      expect(claimBoot()).toBe(true);
      expect(claimBoot()).toBe(false);
    } finally {
      delete (globalThis as Host)[BOOT_FLAG];
    }
  });
});
