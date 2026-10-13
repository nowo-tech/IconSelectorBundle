/**
 * Client-side SVG sanitizer for markup that does not come from the bundle's own (server-sanitized)
 * endpoints, e.g. icon bodies returned by the public Iconify API (api.iconify.design).
 *
 * Mirrors the server-side allowlist of {@see Nowo\IconSelectorBundle\Service\SvgSanitizer}: the markup is
 * parsed as XML (never as HTML), every element/attribute outside the allowlist is removed, and anything
 * that is not a well-formed <svg> document is dropped (fail closed).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Allowed element local names (lowercase). No script, foreignObject, animate*, set, image, a, style. */
const ALLOWED_TAGS = new Set<string>([
  'svg',
  'g',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
  'mask',
  'title',
  'desc',
  'use',
]);

/** Allowed attribute local names (lowercase). Event handlers (on*) and style are never allowed. */
const ALLOWED_ATTRIBUTES = new Set<string>([
  'viewbox',
  'width',
  'height',
  'fill',
  'fill-rule',
  'clip-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'd',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'transform',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'class',
  'id',
  'offset',
  'stop-color',
  'stop-opacity',
  'clip-path',
  'mask',
  'gradientunits',
  'gradienttransform',
  'maskunits',
  'clippathunits',
  'preserveaspectratio',
  'role',
  'aria-hidden',
  'aria-label',
  'focusable',
]);

/** Paint/reference attributes may only point to a same-document fragment: url(#id). */
const URL_REFERENCE_ATTRIBUTES = new Set<string>(['fill', 'stroke', 'clip-path', 'mask']);

function isSafeFragment(value: string): boolean {
  return /^#[A-Za-z0-9_.:-]+$/.test(value.trim());
}

function isSafeAttributeValue(name: string, value: string): boolean {
  if (URL_REFERENCE_ATTRIBUTES.has(name) && /url\s*\(/i.test(value)) {
    return /^url\(\s*#[A-Za-z0-9_.:-]+\s*\)$/i.test(value.trim());
  }

  return true;
}

function sanitizeElement(element: Element): void {
  const tag = element.localName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag) || element.namespaceURI !== SVG_NS) {
    element.remove();

    return;
  }

  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.localName.toLowerCase();
    const qualified = attribute.name.toLowerCase();

    if (qualified === 'xmlns' || qualified.startsWith('xmlns:')) {
      continue;
    }

    const keep =
      name === 'href'
        ? isSafeFragment(attribute.value)
        : !name.startsWith('on') && ALLOWED_ATTRIBUTES.has(name) && isSafeAttributeValue(name, attribute.value);

    if (!keep) {
      element.removeAttributeNode(attribute);
    }
  }

  for (const child of Array.from(element.children)) {
    sanitizeElement(child);
  }
}

/**
 * Sanitizes SVG markup with an element/attribute allowlist.
 *
 * @param svg - Raw SVG markup (a complete `<svg …>…</svg>` document).
 * @returns Sanitized SVG markup, or '' when the input is empty or not a well-formed SVG document.
 */
export function sanitizeSvg(svg: string): string {
  if (svg === '' || typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return '';
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  } catch {
    return '';
  }

  const root = doc.documentElement;
  if (
    !root ||
    root.localName.toLowerCase() !== 'svg' ||
    root.namespaceURI !== SVG_NS ||
    doc.getElementsByTagName('parsererror').length > 0
  ) {
    return '';
  }

  sanitizeElement(root);

  return new XMLSerializer().serializeToString(root);
}

/**
 * Coerces an Iconify dimension to a finite number (the API is untrusted: a string here would be
 * interpolated into the SVG attributes).
 */
export function toSvgNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.NaN;

  return Number.isFinite(n) ? n : fallback;
}
