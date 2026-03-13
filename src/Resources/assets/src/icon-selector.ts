/**
 * Icon selector bundle entry point.
 * Imports Tom Select styles and runs runInit when the DOM is ready (or immediately if already loaded).
 * runInit discovers all [data-controller*="icon-selector"] elements and initializes either IconSelectorIconifyWidget or IconSelectorWidget (or Tom Select for tom_select mode).
 */

import { createBundleLogger } from './logger';
import { setBundleLogger, runInit } from './icon-selector-lib';

declare const __ICON_SELECTOR_BUILD_TIME__: string;

const log = createBundleLogger('icon-selector', {
  buildTime: typeof __ICON_SELECTOR_BUILD_TIME__ !== 'undefined' ? __ICON_SELECTOR_BUILD_TIME__ : undefined,
});
log.scriptLoaded();
setBundleLogger(log);

import 'tom-select/dist/css/tom-select.css';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInit);
} else {
  runInit();
}
