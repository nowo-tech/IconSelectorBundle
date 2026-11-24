/**
 * Icon selector bundle entry point.
 * Imports the styles (extracted to icon-selector.css by the build) and boots the page through bootIconSelector():
 * it logs the "script loaded" line, exposes NowoIconSelector on window (so a Stimulus controller can call
 * initIconSelectorContainer(element) when the component is connected) and runs runInitAndObserve when the DOM is ready
 * (or immediately if already loaded). runInitAndObserve discovers all [data-controller*="icon-selector"] elements,
 * initializes them, and starts a MutationObserver so that icon selectors injected later are initialized automatically.
 * A second copy of this script on the same page does nothing (once-guard, REQ-ASSETS-005).
 */

import { createBundleLogger } from './logger';
import { bootIconSelector } from './icon-selector-boot';

declare const __ICON_SELECTOR_BUILD_TIME__: string;

// Styles are extracted to icon-selector.css at build time (no inline <style> injection: strict CSP).
import 'tom-select/dist/css/tom-select.css';
import './icon-selector.css';

bootIconSelector(
  createBundleLogger('icon-selector', {
    buildTime: typeof __ICON_SELECTOR_BUILD_TIME__ !== 'undefined' ? __ICON_SELECTOR_BUILD_TIME__ : undefined,
  }),
);
