/**
 * REQ-ASSETS-005 once-guard: scriptLoaded() prints at most one line per logger name and page, even when the script is
 * evaluated twice, and a clobbered page-wide registry never throws.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alreadyAnnounced, createBundleLogger } from './logger';

type Host = { __nowoScriptBanners?: unknown };

describe('scriptLoaded() once-guard', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete (globalThis as Host).__nowoScriptBanners;
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as Host).__nowoScriptBanners;
    document.body.innerHTML = '';
  });

  it('logs once when called twice on the same logger', () => {
    const log = createBundleLogger('icon-selector', { buildTime: '2026-11-24 10:00 UTC' });
    log.scriptLoaded();
    log.scriptLoaded();
    expect(consoleLog).toHaveBeenCalledTimes(1);
    expect(String(consoleLog.mock.calls[0]?.[0])).toContain('📦 [icon-selector] script loaded, build: ');
  });

  it('logs once when the script is evaluated twice (two loggers with the same name)', () => {
    createBundleLogger('icon-selector').scriptLoaded();
    createBundleLogger('icon-selector').scriptLoaded();
    createBundleLogger('other-bundle').scriptLoaded();
    expect(consoleLog).toHaveBeenCalledTimes(2);
    expect(String(consoleLog.mock.calls[1]?.[0])).toContain('[other-bundle] script loaded');
  });

  it('keeps names recorded by other bundles in the shared registry', () => {
    (globalThis as Host).__nowoScriptBanners = { 'ui-kit/dialog': true };
    createBundleLogger('icon-selector').scriptLoaded();
    expect(consoleLog).toHaveBeenCalledTimes(1);
    expect((globalThis as Host).__nowoScriptBanners).toEqual({ 'ui-kit/dialog': true, 'icon-selector': true });
  });

  it('replaces a registry that is not a plain object', () => {
    (globalThis as Host).__nowoScriptBanners = 'clobbered';
    expect(alreadyAnnounced('icon-selector')).toBe(false);
    expect(alreadyAnnounced('icon-selector')).toBe(true);
  });

  it('never throws when page HTML clobbers the registry global, and still announces once', () => {
    document.body.innerHTML = '<img id="__nowoScriptBanners" name="x"><img id="__nowoScriptBanners" name="x">';
    Object.defineProperty(globalThis, '__nowoScriptBanners', {
      configurable: true,
      get: () => document.getElementsByName('x'),
      set: () => {
        throw new TypeError('read-only');
      },
    });
    const log = createBundleLogger('clobbered-name');
    expect(() => {
      log.scriptLoaded();
      log.scriptLoaded();
    }).not.toThrow();
    expect(consoleLog).toHaveBeenCalledTimes(1);
  });

  it('falls back to the module-scope set when the registry is not writable as an object', () => {
    Object.defineProperty(globalThis, '__nowoScriptBanners', {
      configurable: true,
      get: () => 'read-only',
      set: () => undefined,
    });
    expect(alreadyAnnounced('fallback-name')).toBe(false);
    expect(alreadyAnnounced('fallback-name')).toBe(true);
  });

  it('does not record a name while quiet, so the line still shows once quiet is lifted', () => {
    (globalThis as { NOWO_CONSOLE?: unknown }).NOWO_CONSOLE = 'quiet';
    createBundleLogger('icon-selector').scriptLoaded();
    delete (globalThis as { NOWO_CONSOLE?: unknown }).NOWO_CONSOLE;
    createBundleLogger('icon-selector').scriptLoaded();
    expect(consoleLog).toHaveBeenCalledTimes(1);
  });
});
