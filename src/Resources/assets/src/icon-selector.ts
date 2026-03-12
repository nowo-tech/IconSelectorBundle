/**
 * Icon selector bundle entry point.
 * Imports Tom Select styles and runs runInit when the DOM is ready (or immediately if already loaded).
 * runInit discovers all [data-controller*="icon-selector"] elements and initializes either IconSelectorIconifyWidget or IconSelectorWidget (or Tom Select for tom_select mode).
 */

import 'tom-select/dist/css/tom-select.css';
import { runInit } from './icon-selector-lib';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInit);
} else {
  runInit();
}
