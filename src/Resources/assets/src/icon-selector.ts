/**
 * Icon selector bundle entry point.
 * Imports Tom Select styles and runs runInitAndObserve when the DOM is ready (or immediately if already loaded).
 * runInitAndObserve discovers all [data-controller*="icon-selector"] elements, initializes them, and starts a
 * MutationObserver so that icon selectors injected later (e.g. from an API response) are initialized automatically.
 *
 * Exposes NowoIconSelector on window so a Stimulus controller can call initIconSelectorContainer(element)
 * when the component is connected (UX component / controller pattern).
 */

import { createBundleLogger } from './logger';
import { setBundleLogger, runInitAndObserve, runInit, initIconSelectorContainer } from './icon-selector-lib';

declare const __ICON_SELECTOR_BUILD_TIME__: string;

const log = createBundleLogger('icon-selector', {
  buildTime: typeof __ICON_SELECTOR_BUILD_TIME__ !== 'undefined' ? __ICON_SELECTOR_BUILD_TIME__ : undefined,
});
log.scriptLoaded();
setBundleLogger(log);

import 'tom-select/dist/css/tom-select.css';

if (typeof window !== 'undefined') {
  (window as unknown as { NowoIconSelector?: { initIconSelectorContainer: typeof initIconSelectorContainer; runInit: typeof runInit; runInitAndObserve: typeof runInitAndObserve } }).NowoIconSelector = {
    initIconSelectorContainer,
    runInit,
    runInitAndObserve,
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInitAndObserve);
} else {
  runInitAndObserve();
}
