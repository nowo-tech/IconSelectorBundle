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

  it('paint attributes follow the allowlist grammar (no CSS escapes, no other functions)', () => {
    const out = sanitizeSvg(
      wrap(
        '<path d="M0 0" fill="#fff" stroke="rgb(1, 2, 3)"/>' +
          '<path d="M1 1" fill="\\75 rl(https://evil.example/a)" stroke="image-set(\'https://evil.example/b\' 1x)"/>' +
          '<path d="M2 2" fill="url(#ok) red" mask="NONE" clip-path="url(#c)"/>' +
          '<path d="M3 3" fill="hsla(10, 20%, 30%, .5)" stroke="currentColor"/>',
      ),
    );

    expect(out).toContain('fill="#fff"');
    expect(out).toContain('stroke="rgb(1, 2, 3)"');
    expect(out).not.toContain('evil.example');
    expect(out).not.toContain('image-set');
    expect(out).not.toContain('url(#ok) red');
    expect(out).toContain('mask="NONE"');
    expect(out).toContain('clip-path="url(#c)"');
    expect(out).toContain('fill="hsla(10, 20%, 30%, .5)"');
    expect(out).toContain('stroke="currentColor"');
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

describe('sanitizeSvg non-element nodes', () => {
  // Processing instructions and CDATA are covered in svg-sanitizer.dom.test.ts (jsdom's XML parser supports them).
  const payloads: Record<string, string> = {
    comment: '<path d="M0 0"/><!--><img src=x onerror=alert(1)>-->',
    'nested foreignObject':
      '<g><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/></div></foreignObject></g><path d="M0 0"/>',
    'style and script': '<style>*{background:url(x)}</style><script>alert(1)</script><path d="M0 0"/>',
  };

  for (const [name, body] of Object.entries(payloads)) {
    it(`drops ${name}`, () => {
      const out = sanitizeSvg(wrap(body));

      expect(out.startsWith('<svg')).toBe(true);
      expect(out).toContain('<path d="M0 0"></path>');
      expect(out).not.toMatch(/<\?|<!|\]\]>|img|onerror|alert|script|style|foreignObject|div/i);
    });
  }

  it('keeps text only inside title and desc, escaped', () => {
    const out = sanitizeSvg(wrap('<title>Home &lt;b&gt; &amp;<path d="M1 1"/></title><desc>A<g/></desc><path d="M0 0"/>'));

    expect(out).toContain('<title>Home &lt;b&gt; &amp;</title>');
    expect(out).toContain('<desc>A</desc>');
    expect(out).not.toContain('M1 1');
  });

  it('escapes attribute values', () => {
    const out = sanitizeSvg(wrap('<path d="M0 0&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"/>'));

    expect(out).toContain('d="M0 0&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"');
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
