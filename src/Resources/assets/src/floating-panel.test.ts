import { afterEach, describe, expect, it, vi } from 'vitest';
import { ATTR_PLACEMENT, choosePlacement, placeFloatingPanel, trackFloatingPanel } from './floating-panel';

const rect = (top: number, height: number): DOMRect =>
  ({ top, bottom: top + height, left: 0, right: 300, width: 300, height, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

function build(anchorTop: number, panelHeight: number): { anchor: HTMLElement; panel: HTMLElement } {
  const anchor = document.createElement('div');
  const panel = document.createElement('div');
  anchor.appendChild(panel);
  document.body.appendChild(anchor);
  anchor.getBoundingClientRect = () => rect(anchorTop, 38);
  panel.getBoundingClientRect = () => rect(0, panelHeight);
  return { anchor, panel };
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
});
