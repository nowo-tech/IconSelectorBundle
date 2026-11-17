<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Service;

use Nowo\IconSelectorBundle\Service\SvgSanitizer;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * @covers \Nowo\IconSelectorBundle\Service\SvgSanitizer
 */
final class SvgSanitizerTest extends TestCase
{
    private SvgSanitizer $sanitizer;

    protected function setUp(): void
    {
        $this->sanitizer = new SvgSanitizer();
    }

    public function testEmptyStringReturnsEmpty(): void
    {
        self::assertSame('', $this->sanitizer->sanitize(''));
    }

    public function testStripScriptTags(): void
    {
        $input  = '<svg><script>alert(1)</script><path d=""/></svg>';
        $output = $this->sanitizer->sanitize($input);
        self::assertStringNotContainsString('script', $output);
        self::assertStringContainsString('<path', $output);
    }

    public function testStripEventAttributes(): void
    {
        $input  = '<svg onload="alert(1)" onerror="x"><path onclick="y"/></svg>';
        $output = $this->sanitizer->sanitize($input);
        self::assertStringNotContainsString('onload', $output);
        self::assertStringNotContainsString('onerror', $output);
        self::assertStringNotContainsString('onclick', $output);
    }

    public function testStripForeignObject(): void
    {
        $input  = '<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject><path d=""/></svg>';
        $output = $this->sanitizer->sanitize($input);
        self::assertStringNotContainsString('foreignObject', $output);
        self::assertStringContainsString('<path', $output);
    }

    public function testStripUnsafeHref(): void
    {
        $input  = '<svg><a href="javascript:alert(1)"><path d=""/></a></svg>';
        $output = $this->sanitizer->sanitize($input);
        self::assertStringNotContainsString('javascript:', $output);
    }

    public function testSafeSvgPreservesPath(): void
    {
        $input  = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';
        $output = $this->sanitizer->sanitize($input);
        self::assertStringContainsString('<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>', $output);
    }

    public function testInvalidSvgFailsClosed(): void
    {
        $input = '<<svg><script>alert(1)</script><foreignObject>x</foreignObject><path d=""/></svg>';
        self::assertSame('', $this->sanitizer->sanitize($input));
    }

    /**
     * Payloads that a regex-based cleanup would let through once the XML parser gives up.
     *
     * @return iterable<string, array{string}>
     */
    public static function malformedPayloadProvider(): iterable
    {
        yield 'unquoted handler' => ['<svg onload=alert(1)><path d="M0 0"></svg>'];
        yield 'unclosed script' => ['<svg><script>alert(1)</svg>'];
        yield 'img onerror in broken svg' => ['<svg><img src=x onerror=alert(1)><</svg>'];
        yield 'html root' => ['<html><body><img src="x" onerror="alert(1)"/></body></html>'];
        yield 'not markup' => ['javascript:alert(1)'];
    }

    #[DataProvider('malformedPayloadProvider')]
    public function testMalformedOrNonSvgMarkupIsDropped(string $input): void
    {
        self::assertSame('', $this->sanitizer->sanitize($input));
    }

    public function testUseElementWithExternalHrefIsStripped(): void
    {
        $input  = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://evil.example/icon.svg#id"/></svg>';
        $output = $this->sanitizer->sanitize($input);
        self::assertStringNotContainsString('https://evil.example', $output);
    }

    public function testUseElementWithEmptyHrefIsStripped(): void
    {
        $input  = '<svg xmlns="http://www.w3.org/2000/svg"><use href=""/></svg>';
        $output = $this->sanitizer->sanitize($input);
        self::assertStringNotContainsString('href=', $output);
    }

    public function testUseElementKeepsSafeFragmentReference(): void
    {
        $input  = '<svg xmlns="http://www.w3.org/2000/svg"><defs><path id="icon" d="M0 0"/></defs><use href="#icon"/></svg>';
        $output = $this->sanitizer->sanitize($input);
        self::assertStringContainsString('#icon', $output);
    }

    /**
     * Non-element nodes that HTML parses differently from XML once the output is inserted with innerHTML.
     *
     * @return iterable<string, array{string}>
     */
    public static function nonElementNodeProvider(): iterable
    {
        yield 'processing instruction' => ['<path d="M0 0"/><?x x><img src=x onerror=alert(1)>?>'];
        yield 'processing instruction with xml-stylesheet target' => ['<path d="M0 0"/><?xml-stylesheet href="x"?><?y <img src=x onerror=alert(1)>?>'];
        yield 'comment' => ['<path d="M0 0"/><!--><img src=x onerror=alert(1)>-->'];
        yield 'cdata' => ['<path d="M0 0"/><![CDATA[><img src=x onerror=alert(1)>]]>'];
        yield 'cdata inside title' => ['<title><![CDATA[</title><img src=x onerror=alert(1)>]]></title><path d="M0 0"/>'];
        yield 'processing instruction inside nested group' => ['<g><g><path d="M0 0"/><?x x><img src=x onerror=alert(1)>?></g></g>'];
        yield 'nested foreignObject' => ['<g><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/></div></foreignObject></g><path d="M0 0"/>'];
        yield 'style and script' => ['<style>*{background:url(x)}</style><script>alert(1)</script><path d="M0 0"/>'];
    }

    #[DataProvider('nonElementNodeProvider')]
    public function testNonElementNodesAreRemoved(string $body): void
    {
        $output = $this->sanitizer->sanitize('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' . $body . '</svg>');

        self::assertStringStartsWith('<svg', $output);
        self::assertStringContainsString('<path d="M0 0"/>', $output);
        foreach (['<?', '<!', ']]>', 'img', 'onerror', 'alert', 'script', 'style', 'foreignObject', 'div'] as $needle) {
            self::assertStringNotContainsString($needle, $output);
        }
    }

    public function testDoctypeAndEntityReferencesAreRemoved(): void
    {
        $input = '<!DOCTYPE svg [<!ENTITY e "<img src=\'x\' onerror=\'alert(1)\'/>"><!ENTITY t "text">]>'
            . '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/>&e;<title>&t;</title></svg>';
        $output = $this->sanitizer->sanitize($input);

        self::assertSame('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/><title/></svg>', $output);
    }

    public function testTitleAndDescKeepTextOnly(): void
    {
        $input  = '<svg xmlns="http://www.w3.org/2000/svg"><title>Home &lt;b&gt;<path d="M1 1"/></title><desc>A<g/></desc><path d="M0 0"/></svg>';
        $output = $this->sanitizer->sanitize($input);

        self::assertSame('<svg xmlns="http://www.w3.org/2000/svg"><title>Home &lt;b&gt;</title><desc>A</desc><path d="M0 0"/></svg>', $output);
    }

    public function testElementsOutsideTheSvgNamespaceAreRemoved(): void
    {
        $input  = '<svg xmlns="http://www.w3.org/2000/svg"><path xmlns="http://www.w3.org/1999/xhtml" d="M1 1"/><path d="M0 0"/></svg>';
        $output = $this->sanitizer->sanitize($input);

        self::assertSame('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>', $output);
    }

    public function testSvgRootOutsideTheSvgNamespaceFailsClosed(): void
    {
        self::assertSame('', $this->sanitizer->sanitize('<svg xmlns="http://www.w3.org/1999/xhtml"><path d="M0 0"/></svg>'));
    }

    public function testTextIsKeptEscaped(): void
    {
        $output = $this->sanitizer->sanitize('<svg><g>a &amp; &lt;img src=x onerror=alert(1)&gt;</g></svg>');

        self::assertSame('<svg><g>a &amp; &lt;img src=x onerror=alert(1)&gt;</g></svg>', $output);
    }

    public function testEntityReferencesInAttributesAreWrittenExpanded(): void
    {
        $input = '<!DOCTYPE svg [<!ENTITY Tab "#"><!ENTITY frag "#icon">]>'
            . '<svg xmlns="http://www.w3.org/2000/svg"><path id="icon" d="M0 0"/>'
            . '<use href="&Tab;javascript:alert(1)"/><use href="&frag;"/><path d="M&Tab;1 1" fill="red"/></svg>';
        $output = $this->sanitizer->sanitize($input);

        self::assertStringNotContainsString('&Tab;', $output);
        self::assertStringNotContainsString('&frag;', $output);
        // The expanded value "#javascript:alert(1)" is no strict #id fragment: the href is dropped.
        self::assertStringNotContainsString('javascript', $output);
        self::assertStringContainsString('<use href="#icon"/>', $output);
        self::assertStringContainsString('<path d="M#1 1" fill="red"/>', $output);
    }

    public function testNamespacedAttributesKeepTheirNamespace(): void
    {
        $input  = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#icon" x="1"/></svg>';
        $output = $this->sanitizer->sanitize($input);

        self::assertSame('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#icon" x="1"/></svg>', $output);
    }

    /** Paint/reference attributes keep only url(#id) (mirrors the browser sanitizer). */
    public function testUrlReferencesAreLimitedToSameDocumentFragments(): void
    {
        $input = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" fill="url(#grad)" stroke="url( #g-2 )"/>'
            . '<path d="M1 1" fill="url(https://evil.example/x.svg#a)" stroke="url(javascript:alert(1))"/>'
            . '<path d="M2 2" clip-path="url(data:image/svg+xml,x)" mask="URL(#ok) extra"/>'
            . '<path d="M3 3" fill="red" stroke="currentColor" mask="none"/></svg>';
        $output = $this->sanitizer->sanitize($input);

        self::assertStringContainsString('fill="url(#grad)"', $output);
        self::assertStringContainsString('stroke="url( #g-2 )"', $output);
        self::assertStringNotContainsString('evil.example', $output);
        self::assertStringNotContainsString('javascript', $output);
        self::assertStringNotContainsString('data:', $output);
        self::assertStringNotContainsString('extra', $output);
        self::assertStringContainsString('<path d="M3 3" fill="red" stroke="currentColor" mask="none"/>', $output);
    }

    /** href keeps only a strict #id fragment. */
    public function testHrefKeepsOnlyStrictFragments(): void
    {
        $output = $this->sanitizer->sanitize('<svg xmlns="http://www.w3.org/2000/svg"><use href="# x"/><use href="#a b"/><use href="#"/><use href="#ok.1:2_3-4"/></svg>');

        self::assertSame('<svg xmlns="http://www.w3.org/2000/svg"><use/><use/><use/><use href="#ok.1:2_3-4"/></svg>', $output);
    }
}
