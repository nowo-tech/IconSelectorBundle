<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Service;

use Nowo\IconSelectorBundle\Service\SvgSanitizer;
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

    public function testInvalidSvgUsesRegexFallback(): void
    {
        $input  = '<<svg><script>alert(1)</script><foreignObject>x</foreignObject><path d=""/></svg>';
        $output = $this->sanitizer->sanitize($input);
        self::assertStringNotContainsString('script', strtolower($output));
        self::assertStringNotContainsString('foreignobject', strtolower($output));
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
}
