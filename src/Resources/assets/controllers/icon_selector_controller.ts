/**
 * Stimulus controller for the icon selector (UX component pattern).
 * Register this controller in your Stimulus application so that elements with
 * data-controller="icon-selector" are initialized when connected to the DOM
 * (e.g. in Turbo frames or when HTML is injected).
 *
 * The controller imports the lib directly; you do not need to load icon-selector.js
 * if your app bundle includes this controller. Ensure Tom Select CSS is loaded
 * when using tom_select mode (e.g. import 'tom-select/dist/css/tom-select.css').
 *
 * Register: application.register('icon-selector', IconSelectorController);
 */

import { Controller } from '@hotwired/stimulus';
import { disposeIconSelectorContainer, getLogger, type IconSelectorDisposer, initIconSelectorContainer } from '../src/icon-selector-lib';

export default class IconSelectorController extends Controller {
  private cleanup: IconSelectorDisposer | null = null;

  connect(): void {
    if (this.element instanceof HTMLElement) {
      const cleanup = initIconSelectorContainer(this.element);
      if (cleanup) {
        this.cleanup = cleanup;
        getLogger().debug('icon-selector (controller): input initialized', this.element);
      }
    }
  }

  disconnect(): void {
    if (!(this.element instanceof HTMLElement)) return;

    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
      return;
    }

    disposeIconSelectorContainer(this.element);
  }
}
