/**
 * Client-side SVG sanitizer for markup that does not come from the bundle's own (server-sanitized)
 * endpoints, e.g. icon bodies returned by the public Iconify API (api.iconify.design).
 *
 * Mirrors the server-side allowlist of {@see Nowo\IconSelectorBundle\Service\SvgSanitizer}: the markup is
 * parsed as XML (never as HTML), every element/attribute outside the allowlist is removed, and anything
 * that is not a well-formed <svg> document is dropped (fail closed).
 *
 * The output is not produced by XMLSerializer: it is rebuilt from the sanitised tree with only allowlisted
 * elements, allowlisted attributes and text, escaped explicitly. Processing instructions, comments, CDATA
 * sections, doctypes and entity references are never emitted, so the string cannot change meaning when the
 * caller later inserts it with innerHTML (HTML parsing rules differ from XML for those constructs).
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

/**
 * Elements that are HTML integration points inside SVG (their content is parsed with HTML rules when the
 * markup is inserted with innerHTML). They keep text only, never child elements.
 */
const TEXT_ONLY_TAGS = new Set<string>(['title', 'desc']);

/** Attribute qualified names that may be written back verbatim (letters, digits, '-', '_', '.', ':'). */
const SAFE_ATTRIBUTE_NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

function isAllowedAttribute(attribute: Attr): boolean {
  const name = attribute.localName.toLowerCase();
  const qualified = attribute.name.toLowerCase();

  if (!SAFE_ATTRIBUTE_NAME.test(attribute.name)) {
    return false;
  }

  if (qualified === 'xmlns' || qualified.startsWith('xmlns:')) {
    return true;
  }

  if (name === 'href') {
    return isSafeFragment(attribute.value);
  }

  return !name.startsWith('on') && ALLOWED_ATTRIBUTES.has(name) && isSafeAttributeValue(name, attribute.value);
}

/**
 * Serialises an allowlisted element and its allowlisted descendants. Anything that is not an allowlisted
 * SVG element or a text node (processing instructions, comments, CDATA, entity references, foreign
 * elements) is dropped together with its content.
 */
function serializeElement(element: Element): string {
  const tag = element.localName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag) || element.namespaceURI !== SVG_NS) {
    return '';
  }

  let out = `<${element.localName}`;
  for (const attribute of Array.from(element.attributes)) {
    if (isAllowedAttribute(attribute)) {
      out += ` ${attribute.name}="${escapeAttribute(attribute.value)}"`;
    }
  }
  out += '>';

  const textOnly = TEXT_ONLY_TAGS.has(tag);
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === TEXT_NODE) {
      out += escapeText((child as Text).data);
    } else if (child.nodeType === ELEMENT_NODE && !textOnly) {
      out += serializeElement(child as Element);
    }
  }

  return `${out}</${element.localName}>`;
}

/**
 * Sanitizes SVG markup with an element/attribute allowlist.
 *
 * @param svg - Raw SVG markup (a complete `<svg …>…</svg>` document).
 * @returns Sanitized SVG markup, or '' when the input is empty or not a well-formed SVG document.
 */
export function sanitizeSvg(svg: string): string {
  if (svg === '' || typeof DOMParser === 'undefined') {
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

  return serializeElement(root);
}

/**
 * Coerces an Iconify dimension to a finite number (the API is untrusted: a string here would be
 * interpolated into the SVG attributes).
 */
export function toSvgNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.NaN;

  return Number.isFinite(n) ? n : fallback;
}
