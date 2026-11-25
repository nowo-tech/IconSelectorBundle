/**
 * Placement of the floating picker panels (1.9.2).
 *
 * Every panel of the widget (`.icon-selector-panel` of both icon widgets, `.icon-selector-emoji-panel` of the Emoji
 * tab) is position:absolute under its picker holder (`.icon-selector-picker-widget`, position:relative), so opening it never
 * moves the page content. When there is not enough room below the holder and there is more room above, the panel opens
 * upwards. The choice is written as an attribute (`data-icon-selector-placement="above"`) and drawn by
 * icon-selector.css: no inline style (strict CSP) and hosts can restyle it.
 *
 * CSS anchor positioning (`position-try-fallbacks: flip-block`) would do this declaratively, but it is not available in
 * every supported browser yet, and a top-layer popover would lose the "same width as the field" sizing the panel gets
 * from its holder. A measurement on open (and when the panel or the window resizes while open) keeps one mechanism for
 * every browser.
 */

/** Panel attribute: "above" when the panel opens upwards; absent when it opens below (default). */
export const ATTR_PLACEMENT = 'data-icon-selector-placement';

/** Which side of the anchor the panel goes to. */
export type PanelPlacement = 'below' | 'above';

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
 * Places an open panel below or above its anchor (no-op for a hidden panel, which is reset to "below").
 *
 * @param panel - The `.icon-selector-panel` element.
 * @param anchor - The element the panel hangs from (its picker holder).
 * @returns The placement applied.
 */
export function placeFloatingPanel(panel: HTMLElement, anchor: HTMLElement): PanelPlacement {
  const vh = viewportHeight();
  const placement: PanelPlacement = panel.hidden || vh <= 0
    ? 'below'
    : (() => {
        const a = anchor.getBoundingClientRect();
        return choosePlacement(panel.getBoundingClientRect().height, a.top, a.bottom, vh);
      })();
  if (placement === 'above') {
    if (panel.getAttribute(ATTR_PLACEMENT) !== 'above') panel.setAttribute(ATTR_PLACEMENT, 'above');
  } else if (panel.hasAttribute(ATTR_PLACEMENT)) {
    panel.removeAttribute(ATTR_PLACEMENT);
  }
  return placement;
}

/**
 * Places an open panel now and again whenever the panel (its content loads lazily) or the window resizes.
 *
 * @param panel - The `.icon-selector-panel` element (already shown).
 * @param anchor - The element the panel hangs from.
 * @returns Stop function: removes the listeners and resets the placement. Call it when the panel closes.
 */
export function trackFloatingPanel(panel: HTMLElement, anchor: HTMLElement): () => void {
  const place = (): void => {
    placeFloatingPanel(panel, anchor);
  };
  place();
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
  observer?.observe(panel);
  window.addEventListener('resize', place);
  return () => {
    observer?.disconnect();
    window.removeEventListener('resize', place);
    panel.removeAttribute(ATTR_PLACEMENT);
  };
}
