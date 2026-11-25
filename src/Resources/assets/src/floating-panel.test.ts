import { afterEach, describe, expect, it, vi } from 'vitest';
import { ATTR_LAYER, ATTR_PLACEMENT, choosePlacement, PANEL_GAP, placeFloatingPanel, trackFloatingPanel } from './floating-panel';

const rect = (top: number, height: number): DOMRect =>
  ({ top, bottom: top + height, left: 0, right: 300, width: 300, height, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

function build(anchorTop: number, panelHeight: number): { anchor: HTMLElement; panel: HTMLElement } {
  const anchor = document.createElement('div');
  const panel = document.createElement('div');
  anchor.appendChild(panel);
  document.body.appendChild(anchor);
  anchor.getBoundingClientRect = () => rect(anchorTop, 38);
  panel.getBoundingClientRect = () => rect(0, panelHeight);
  // Fallback layout by default (no Popover API); the top-layer tests install their own popover methods.
  Object.defineProperty(panel, 'showPopover', { value: undefined, configurable: true });
  return { anchor, panel };
}

/** Gives the panel a Popover API (records the calls). */
function withPopover(panel: HTMLElement, opts: { failShow?: boolean; failHide?: boolean } = {}): { shown: () => boolean } {
  let open = false;
  Object.defineProperty(panel, 'showPopover', {
    configurable: true,
    value: () => {
      if (opts.failShow) throw new DOMException('Invalid state', 'InvalidStateError');
      open = true;
    },
  });
  Object.defineProperty(panel, 'hidePopover', {
    configurable: true,
    value: () => {
      if (opts.failHide) throw new DOMException('Invalid state', 'InvalidStateError');
      open = false;
    },
  });
  return { shown: () => open };
}

describe('floating panel placement', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('chooses below unless the panel does not fit there and there is more room above', () => {
    expect(choosePlacement(200, 100, 138, 800)).toBe('below');
    expect(choosePlacement(200, 600, 638, 800)).toBe('above');
    // Does not fit on either side: the larger side wins.
    expect(choosePlacement(700, 300, 338, 800)).toBe('below');
    expect(choosePlacement(700, 500, 538, 800)).toBe('above');
    // Exactly fits below.
    expect(choosePlacement(162, 600, 638, 800)).toBe('below');
  });

  it('sets and clears the placement attribute, and keeps a hidden panel below', () => {
    vi.stubGlobal('innerHeight', 600);
    const { anchor, panel } = build(540, 300);
    expect(placeFloatingPanel(panel, anchor)).toBe('above');
    expect(panel.getAttribute(ATTR_PLACEMENT)).toBe('above');
    expect(placeFloatingPanel(panel, anchor)).toBe('above');
    anchor.getBoundingClientRect = () => rect(20, 38);
    expect(placeFloatingPanel(panel, anchor)).toBe('below');
    expect(panel.hasAttribute(ATTR_PLACEMENT)).toBe(false);
    expect(placeFloatingPanel(panel, anchor)).toBe('below');

    anchor.getBoundingClientRect = () => rect(540, 38);
    panel.hidden = true;
    expect(placeFloatingPanel(panel, anchor)).toBe('below');
    expect(panel.hasAttribute(ATTR_PLACEMENT)).toBe(false);
  });

  it('stays below when the viewport height is unknown', () => {
    vi.stubGlobal('innerHeight', 0);
    const clientHeight = vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(0);
    const { anchor, panel } = build(540, 300);
    expect(placeFloatingPanel(panel, anchor)).toBe('below');
    clientHeight.mockReturnValue(600);
    expect(placeFloatingPanel(panel, anchor)).toBe('above');
    clientHeight.mockRestore();
  });

  it('tracks panel and window resizes while open and resets on stop', () => {
    vi.stubGlobal('innerHeight', 600);
    let resize: (() => void) | null = null;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resize = cb;
        }
        observe(): void {}
        disconnect(): void {
          disconnect();
        }
      },
    );
    const { anchor, panel } = build(400, 50);
    const stop = trackFloatingPanel(panel, anchor);
    expect(panel.hasAttribute(ATTR_PLACEMENT)).toBe(false);

    // Lazy content makes the panel taller: it flips up.
    panel.getBoundingClientRect = () => rect(0, 300);
    resize!();
    expect(panel.getAttribute(ATTR_PLACEMENT)).toBe('above');

    // The window grows: room below again.
    vi.stubGlobal('innerHeight', 1200);
    window.dispatchEvent(new Event('resize'));
    expect(panel.hasAttribute(ATTR_PLACEMENT)).toBe(false);

    vi.stubGlobal('innerHeight', 600);
    window.dispatchEvent(new Event('resize'));
    expect(panel.getAttribute(ATTR_PLACEMENT)).toBe('above');
    stop();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(panel.hasAttribute(ATTR_PLACEMENT)).toBe(false);
    window.dispatchEvent(new Event('resize'));
    expect(panel.hasAttribute(ATTR_PLACEMENT)).toBe(false);
  });

  it('works without ResizeObserver', () => {
    vi.stubGlobal('innerHeight', 600);
    vi.stubGlobal('ResizeObserver', undefined);
    const { anchor, panel } = build(540, 300);
    const stop = trackFloatingPanel(panel, anchor);
    expect(panel.getAttribute(ATTR_PLACEMENT)).toBe('above');
    stop();
    expect(panel.hasAttribute(ATTR_PLACEMENT)).toBe(false);
  });

  it('top layer: shows the panel as a manual popover with viewport coordinates, follows scrolls, cleans up on stop', () => {
    vi.stubGlobal('innerHeight', 600);
    vi.stubGlobal('ResizeObserver', undefined);
    const { anchor, panel } = build(100, 200);
    anchor.getBoundingClientRect = () => ({ ...rect(100, 38), left: 24.4, width: 320 }) as DOMRect;
    const popover = withPopover(panel);
    const stop = trackFloatingPanel(panel, anchor);
    expect(popover.shown()).toBe(true);
    expect(panel.getAttribute('popover')).toBe('manual');
    expect(panel.getAttribute(ATTR_LAYER)).toBe('top');
    expect(panel.style.getPropertyValue('top')).toBe(`${100 + 38 + PANEL_GAP}px`);
    expect(panel.style.getPropertyValue('left')).toBe('24px');
    expect(panel.style.getPropertyValue('width')).toBe('320px');

    // The trigger scrolled near the bottom: the panel goes above it.
    anchor.getBoundingClientRect = () => ({ ...rect(500, 38), left: 24, width: 320 }) as DOMRect;
    document.dispatchEvent(new Event('scroll'));
    expect(panel.getAttribute(ATTR_PLACEMENT)).toBe('above');
    expect(panel.style.getPropertyValue('top')).toBe(`${500 - 200 - PANEL_GAP}px`);

    stop();
    expect(popover.shown()).toBe(false);
    expect(panel.hasAttribute('popover')).toBe(false);
    expect(panel.hasAttribute(ATTR_LAYER)).toBe(false);
    expect(panel.hasAttribute('style')).toBe(false);
    expect(panel.hasAttribute(ATTR_PLACEMENT)).toBe(false);
    anchor.getBoundingClientRect = () => rect(100, 38);
    document.dispatchEvent(new Event('scroll'));
    expect(panel.hasAttribute('style')).toBe(false);
  });

  it('top layer: falls back to the in-page layout when the popover cannot be shown, and tolerates a failing hide', () => {
    vi.stubGlobal('innerHeight', 600);
    const { anchor, panel } = build(100, 200);
    withPopover(panel, { failShow: true });
    const stop = trackFloatingPanel(panel, anchor);
    expect(panel.hasAttribute('popover')).toBe(false);
    expect(panel.hasAttribute(ATTR_LAYER)).toBe(false);
    expect(panel.hasAttribute('style')).toBe(false);
    stop();

    const other = build(100, 200);
    withPopover(other.panel, { failHide: true });
    const stop2 = trackFloatingPanel(other.panel, other.anchor);
    expect(other.panel.getAttribute(ATTR_LAYER)).toBe('top');
    expect(() => stop2()).not.toThrow();
    expect(other.panel.hasAttribute('popover')).toBe(false);

    // A panel that is not in the document stays in the fallback layout.
    const detached = document.createElement('div');
    withPopover(detached);
    const stop3 = trackFloatingPanel(detached, other.anchor);
    expect(detached.hasAttribute('popover')).toBe(false);
    stop3();

    // A hidden panel in the top layer gets no coordinates.
    const hidden = build(100, 200);
    withPopover(hidden.panel);
    hidden.panel.setAttribute(ATTR_LAYER, 'top');
    hidden.panel.hidden = true;
    expect(placeFloatingPanel(hidden.panel, hidden.anchor)).toBe('below');
    expect(hidden.panel.hasAttribute('style')).toBe(false);
  });
});
