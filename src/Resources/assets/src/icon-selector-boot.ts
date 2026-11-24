/**
 * Page-level boot of the icon selector script, guarded so that a script evaluated twice (two copies of the IIFE, Turbo,
 * a fragment that re-adds the tag) initialises the page once: one "script loaded" line, one `window.NowoIconSelector`,
 * one discovery pass and one MutationObserver (REQ-ASSETS-005 once-guard).
 */

import type { BundleLogger } from './logger';
import { setBundleLogger, runInitAndObserve, runInit, initIconSelectorContainer } from './icon-selector-lib';

/** Public API exposed on `window.NowoIconSelector` (used by the Stimulus controller). */
export type NowoIconSelectorApi = {
  initIconSelectorContainer: typeof initIconSelectorContainer;
  runInit: typeof runInit;
  runInitAndObserve: typeof runInitAndObserve;
};

/** Page-wide flag set by the first copy of the script that boots. */
export const BOOT_FLAG = '__nowoIconSelectorBooted';

/** Fallback when the page-wide flag cannot be written (clobbered or read-only global). */
let bootedHere = false;

/**
 * Claims the page-wide boot. Page HTML can clobber the global (DOM named access), so only the literal `true` counts as
 * booted, every access is wrapped in `try/catch`, and a module-scope flag is the fallback.
 *
 * @returns True for the first caller on the page, false for every later one.
 */
export function claimBoot(): boolean {
  try {
    const host = globalThis as Record<string, unknown>;
    if (host[BOOT_FLAG] === true) {
      return false;
    }
    host[BOOT_FLAG] = true;
    if (host[BOOT_FLAG] === true) {
      return true;
    }
  } catch {
    // Clobbered or read-only global: fall back to the module-scope flag.
  }
  if (bootedHere) {
    return false;
  }
  bootedHere = true;

  return true;
}

/**
 * Logs the "script loaded" line (once per page), then, for the first copy only, exposes the API on
 * `window.NowoIconSelector` and initialises the icon selectors when the DOM is ready.
 *
 * @param log - The bundle logger of this copy of the script.
 * @returns True when this call booted the page, false when an earlier copy already did.
 */
export function bootIconSelector(log: BundleLogger): boolean {
  log.scriptLoaded();
  if (!claimBoot()) {
    return false;
  }
  setBundleLogger(log);

  const api: NowoIconSelectorApi = { initIconSelectorContainer, runInit, runInitAndObserve };
  (window as unknown as { NowoIconSelector?: NowoIconSelectorApi }).NowoIconSelector = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitAndObserve, { once: true });
  } else {
    runInitAndObserve();
  }

  return true;
}
