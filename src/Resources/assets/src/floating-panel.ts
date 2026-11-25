/**
 * Placement of the floating picker panels (1.9.2).
 *
 * Every panel of the widget (`.icon-selector-panel` of both icon widgets, `.icon-selector-emoji-panel` of the Emoji
 * tab) hangs from its picker holder (`.icon-selector-picker-widget`) and never moves the page content.
 *
 * - Top layer (browsers with the Popover API, Firefox included): while open, the panel is a manual popover
 *   (`popover="manual"`, `showPopover()`), so no ancestor with `overflow: hidden` (a card, a scroll box) can clip it.
 *   The top layer is positioned in the viewport, so the script writes `top`, `left` and `width` through the CSSOM
 *   (`element.style.setProperty`), which a strict `style-src` does not block (only `style` attributes in markup and
 *   inline `<style>` are). They are recomputed on scroll, on resize and when the panel content changes size, and
 *   removed when the panel closes. CSS anchor positioning would avoid the script, but it is not available in Firefox.
 * - Fallback (no Popover API): the panel is `position: absolute` under its holder (icon-selector.css), as before.
 *
 * When there is not enough room below the trigger and there is more room above, the panel opens upwards
 * (`data-icon-selector-placement="above"`, also drawn by icon-selector.css in the fallback layout).
 */

/** Panel attribute: "above" when the panel opens upwards; absent when it opens below (default). */
export const ATTR_PLACEMENT = 'data-icon-selector-placement';

/** Panel attribute: "top" while the panel is shown in the top layer (popover, viewport coordinates). */
export const ATTR_LAYER = 'data-icon-selector-layer';

/** Gap (px) between the trigger and the panel, the .25rem margin of the fallback layout. */
export const PANEL_GAP = 4;

/** Which side of the anchor the panel goes to. */
export type PanelPlacement = 'below' | 'above';

type PopoverElement = HTMLElement & { showPopover?: () => void; hidePopover?: () => void };

/**
 * Chooses the side for an open panel: below unless it does not fit there and there is more room above.
 *
 * @param panelHeight - Height of the open panel (px).
 * @param anchorTop - Top of the anchor in the viewport (px).
 * @param anchorBottom - Bottom of the anchor in the viewport (px).
 * @param viewportHeight - Height of the viewport (px).
 */
export function choosePlacement(panelHeight: number, anchorTop: number, anchorBottom: number, viewportHeight: number): PanelPlacement {
  const below = viewportHeight - anchorBottom;
  const above = anchorTop;
  return panelHeight > below && above > below ? 'above' : 'below';
}

/** Viewport height (0 when unknown: the panel then stays below). */
function viewportHeight(): number {
  return window.innerHeight || document.documentElement.clientHeight;
}

/**
 * Places an open panel below or above its anchor (a hidden panel is reset to "below"). In the top layer it also writes
 * the panel's viewport coordinates and width (CSSOM).
 *
 * @param panel - The panel element.
 * @param anchor - The element the panel hangs from (its picker holder).
 * @returns The placement applied.
 */
export function placeFloatingPanel(panel: HTMLElement, anchor: HTMLElement): PanelPlacement {
  const vh = viewportHeight();
  let placement: PanelPlacement = 'below';
  if (!panel.hidden && vh > 0) {
    const a = anchor.getBoundingClientRect();
    const topLayer = panel.getAttribute(ATTR_LAYER) === 'top';
    // Width first: the height of the panel depends on it.
    if (topLayer) panel.style.setProperty('width', `${a.width}px`);
    const height = panel.getBoundingClientRect().height;
    placement = choosePlacement(height, a.top, a.bottom, vh);
    if (topLayer) {
      const top = placement === 'above' ? a.top - height - PANEL_GAP : a.bottom + PANEL_GAP;
      panel.style.setProperty('top', `${Math.round(top)}px`);
      panel.style.setProperty('left', `${Math.round(a.left)}px`);
    }
  }
  if (placement === 'above') {
    if (panel.getAttribute(ATTR_PLACEMENT) !== 'above') panel.setAttribute(ATTR_PLACEMENT, 'above');
  } else if (panel.hasAttribute(ATTR_PLACEMENT)) {
    panel.removeAttribute(ATTR_PLACEMENT);
  }
  return placement;
}

/**
 * Moves an open panel to the top layer when the browser has the Popover API.
 *
 * @returns True when the panel is now a shown popover.
 */
function enterTopLayer(panel: PopoverElement): boolean {
  if (typeof panel.showPopover !== 'function' || !panel.isConnected) return false;
  try {
    panel.setAttribute('popover', 'manual');
    panel.showPopover();
    panel.setAttribute(ATTR_LAYER, 'top');
    return true;
  } catch {
    // Not allowed here (e.g. already shown): keep the fallback layout.
    panel.removeAttribute('popover');
    return false;
  }
}

/** Leaves the top layer and drops every trace of it (attributes and CSSOM coordinates). */
function leaveTopLayer(panel: PopoverElement): void {
  try {
    (panel.hidePopover as () => void)();
  } catch {
    // Not shown any more (e.g. the element was moved): nothing to hide.
  }
  panel.removeAttribute('popover');
  panel.removeAttribute(ATTR_LAYER);
  panel.removeAttribute('style');
}

/**
 * Shows an open panel in the top layer when possible and places it now and again whenever the panel (its content
 * loads lazily) or the window resizes, or anything scrolls (top layer only).
 *
 * @param panel - The panel element (already un-hidden).
 * @param anchor - The element the panel hangs from.
 * @returns Stop function: removes the listeners, leaves the top layer and resets the placement. Call it on close.
 */
export function trackFloatingPanel(panel: HTMLElement, anchor: HTMLElement): () => void {
  const topLayer = enterTopLayer(panel);
  const place = (): void => {
    placeFloatingPanel(panel, anchor);
  };
  place();
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
  observer?.observe(panel);
  window.addEventListener('resize', place);
  if (topLayer) document.addEventListener('scroll', place, { capture: true, passive: true });
  return () => {
    observer?.disconnect();
    window.removeEventListener('resize', place);
    if (topLayer) {
      document.removeEventListener('scroll', place, { capture: true });
      leaveTopLayer(panel);
    }
    panel.removeAttribute(ATTR_PLACEMENT);
  };
}
