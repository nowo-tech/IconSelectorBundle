import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizeSvg, toSvgNumber } from './svg-sanitizer';

const wrap = (body: string, attrs = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24"${attrs}>${body}</svg>`;

describe('sanitizeSvg', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps allowed shapes and presentation attributes', () => {
    const out = sanitizeSvg(
      wrap('<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M0 0h24v24H0z"/><circle cx="1" cy="2" r="3"/>'),
    );

    expect(out).toContain('<path');
    expect(out).toContain('d="M0 0h24v24H0z"');
    expect(out).toContain('fill-rule="evenodd"');
    expect(out).toContain('<circle');
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('removes script, foreignObject, animate and other non-allowlisted elements', () => {
    const out = sanitizeSvg(
      wrap(
        '<script>alert(1)</script><foreignObject><div>x</div></foreignObject>' +
          '<a href="javascript:alert(1)"><path d="M1 1"/></a>' +
          '<animate attributeName="href" values="javascript:alert(1)"/><set attributeName="onclick" to="alert(1)"/>' +
          '<image href="https://evil.example/x.png"/><style>*{}</style><g><path d="M2 2"/></g>',
      ),
    );

    expect(out).not.toMatch(/script|foreignObject|<a\b|animate|<set\b|<image|<style|javascript|alert/i);
    expect(out).toContain('<g>');
    expect(out).toContain('d="M2 2"');
  });

  it('removes event handlers, style and unknown attributes', () => {
    const out = sanitizeSvg(wrap('<path d="M0 0" onclick="alert(1)" onload="alert(2)" style="x" data-x="1"/>', ' onload="alert(3)"'));

    expect(out).not.toMatch(/onclick|onload|style=|data-x|alert/);
    expect(out).toContain('d="M0 0"');
  });

  it('keeps only same-document fragment references in href / xlink:href / url()', () => {
    const out = sanitizeSvg(
      wrap(
        '<defs><linearGradient id="g1"><stop offset="0" stop-color="#000"/></linearGradient></defs>' +
          '<use href="#g1"/><use xlink:href="#g1"/><use href="https://evil.example/s.svg#x"/>' +
          '<use xlink:href="javascript:alert(1)"/>' +
          '<rect fill="url(#g1)" width="1" height="1"/><rect fill="url(https://evil.example/x)" stroke="red" width="2" height="2"/>',
      ),
    );

    expect(out).toContain('href="#g1"');
    expect(out).toContain('fill="url(#g1)"');
    expect(out).toContain('stroke="red"');
    expect(out).not.toMatch(/evil\.example|javascript/);
  });

  it('fails closed on empty, malformed or non-svg input', () => {
    expect(sanitizeSvg('')).toBe('');
    expect(sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path></svg>')).toBe('');
    expect(sanitizeSvg('<html xmlns="http://www.w3.org/1999/xhtml"><body/></html>')).toBe('');
    expect(sanitizeSvg('<svg><path d="M0 0"/></svg>')).toBe('');
  });

  it('fails closed when the parser throws or is unavailable', () => {
    vi.spyOn(DOMParser.prototype, 'parseFromString').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(sanitizeSvg(wrap('<path d="M0 0"/>'))).toBe('');
    vi.restoreAllMocks();

    vi.stubGlobal('DOMParser', undefined);
    expect(sanitizeSvg(wrap('<path d="M0 0"/>'))).toBe('');
  });

  it('fails closed when the parsed document has no root element', () => {
    vi.spyOn(DOMParser.prototype, 'parseFromString').mockReturnValue({
      documentElement: null,
    } as unknown as Document);

    expect(sanitizeSvg(wrap('<path d="M0 0"/>'))).toBe('');
  });
});

describe('toSvgNumber', () => {
  it('accepts finite numbers and falls back otherwise', () => {
    expect(toSvgNumber(16, 24)).toBe(16);
    expect(toSvgNumber(0, 24)).toBe(0);
    expect(toSvgNumber(undefined, 24)).toBe(24);
    expect(toSvgNumber('24" onload="alert(1)', 24)).toBe(24);
    expect(toSvgNumber(Number.POSITIVE_INFINITY, 7)).toBe(7);
  });
});
