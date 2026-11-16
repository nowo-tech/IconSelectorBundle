// @vitest-environment jsdom
/**
 * Inserts sanitizer output with innerHTML in a spec-compliant HTML parser (jsdom / parse5) and checks that the
 * markup cannot leave the SVG context: no HTML element, no event handler attribute, no script-capable node.
 */
import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from './svg-sanitizer';

const SVG_NS = 'http://www.w3.org/2000/svg';

const wrap = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24">${body}</svg>`;

const payloads: Record<string, string> = {
  'processing instruction': '<path d="M0 0"/><?x x><img src=x onerror=alert(1)>?>',
  'processing instruction in nested group': '<g><path d="M0 0"/><?x x><img src=x onerror=alert(1)>?></g>',
  comment: '<path d="M0 0"/><!--><img src=x onerror=alert(1)>-->',
  cdata: '<path d="M0 0"/><![CDATA[><img src=x onerror=alert(1)>]]>',
  'cdata inside title': '<title><![CDATA[</title><img src=x onerror=alert(1)>]]></title><path d="M0 0"/>',
  'nested title rcdata': '<title><title><path d="&lt;/title&gt;&lt;img src=x onerror=alert(1)&gt;"/></title></title><path d="M0 0"/>',
  'escaped markup in text': '<g>&lt;/svg&gt;&lt;img src=x onerror=alert(1)&gt;</g><path d="M0 0"/>',
  'escaped markup in attribute': '<path d="M0 0" class="&quot;&gt;&lt;/svg&gt;&lt;img src=x onerror=alert(1)&gt;"/>',
  'nested foreignObject':
    '<g><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/></div></foreignObject></g><path d="M0 0"/>',
  'style and script': '<style>*{background:url(x)}</style><script>alert(1)</script><path d="M0 0"/>',
};

function insert(markup: string): HTMLElement {
  const host = document.createElement('span');
  host.innerHTML = markup;

  return host;
}

describe('sanitizeSvg output inserted with innerHTML', () => {
  for (const [name, body] of Object.entries(payloads)) {
    it(`stays inside the SVG context: ${name}`, () => {
      const out = sanitizeSvg(wrap(body));
      expect(out).not.toBe('');
      expect(out).not.toMatch(/<[?!]|\]\]>/);

      const host = insert(out);

      expect(host.querySelectorAll('img, script, style, foreignObject, iframe').length).toBe(0);
      expect(host.children.length).toBe(1);
      expect(host.firstElementChild?.namespaceURI).toBe(SVG_NS);
      for (const element of Array.from(host.querySelectorAll('*'))) {
        expect(element.namespaceURI).toBe(SVG_NS);
        for (const attribute of Array.from(element.attributes)) {
          expect(attribute.name.toLowerCase().startsWith('on')).toBe(false);
        }
      }
      expect(host.querySelector('path')).not.toBeNull();
    });
  }

  it('drops the doctype', () => {
    const out = sanitizeSvg(
      `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">${wrap('<path d="M0 0"/>')}`,
    );

    expect(out.startsWith('<svg')).toBe(true);
    expect(out).not.toContain('<!');
  });

  it('never emits markup from internal entity declarations', () => {
    const out = sanitizeSvg(
      `<!DOCTYPE svg [<!ENTITY e "<img src='x' onerror='alert(1)'/>">]>${wrap('<path d="M0 0"/>&e;')}`,
    );

    expect(out).not.toMatch(/<[?!]|&e;|<img/);
    expect(insert(out).querySelectorAll('img').length).toBe(0);
  });

  it('drops attributes whose names cannot be written back safely', () => {
    const out = sanitizeSvg(wrap('<path d="M0 0" \u00e9="1"/>'));

    expect(out).toContain('<path d="M0 0"></path>');
    expect(out).not.toContain('\u00e9');
  });

  it('the unsanitised processing instruction payload does create an HTML img (control)', () => {
    const host = insert(wrap(payloads['processing instruction']));

    expect(host.querySelectorAll('img').length).toBe(1);
  });
});
