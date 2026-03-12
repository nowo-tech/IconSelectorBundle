<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Service;

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

    public function testSafeSvgUnchanged(): void
    {
        $input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';
        self::assertSame($input, $this->sanitizer->sanitize($input));
    }
}
