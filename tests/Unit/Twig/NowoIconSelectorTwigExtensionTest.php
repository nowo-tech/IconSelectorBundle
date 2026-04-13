<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Twig;

use Nowo\IconSelectorBundle\Twig\NowoIconSelectorTwigExtension;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for NowoIconSelectorTwigExtension.
 *
 * @covers \Nowo\IconSelectorBundle\Twig\NowoIconSelectorTwigExtension
 */
final class NowoIconSelectorTwigExtensionTest extends TestCase
{
    public function testGetFunctionsReturnsAssetPathFunction(): void
    {
        $ext = new NowoIconSelectorTwigExtension();
        $fns = $ext->getFunctions();

        self::assertCount(1, $fns);
        self::assertSame('nowo_icon_selector_asset_path', $fns[0]->getName());
    }

    public function testAssetPathReturnsPathWithAssetDir(): void
    {
        $ext = new NowoIconSelectorTwigExtension();

        self::assertSame('bundles/nowoiconselector/icon-selector.js', $ext->assetPath('icon-selector.js'));
        self::assertSame('bundles/nowoiconselector/icon-selector.js', $ext->assetPath('/icon-selector.js'));
    }

    public function testAssetDirConstant(): void
    {
        $ext = new NowoIconSelectorTwigExtension();
        self::assertStringStartsWith('bundles/' . NowoIconSelectorTwigExtension::ASSET_DIR . '/', $ext->assetPath('file.js'));
    }

    /** Path traversal (..) is rejected and returns safe default path. */
    public function testAssetPathRejectsPathTraversal(): void
    {
        $ext     = new NowoIconSelectorTwigExtension();
        $default = 'bundles/' . NowoIconSelectorTwigExtension::ASSET_DIR . '/icon-selector.js';
        self::assertSame($default, $ext->assetPath('../other/file.js'));
        self::assertSame($default, $ext->assetPath('sub/../../etc/passwd'));
    }

    /** Invalid characters in filename yield safe default path. */
    public function testAssetPathRejectsInvalidCharacters(): void
    {
        $ext     = new NowoIconSelectorTwigExtension();
        $default = 'bundles/' . NowoIconSelectorTwigExtension::ASSET_DIR . '/icon-selector.js';
        self::assertSame($default, $ext->assetPath('file<script>.js'));
        self::assertSame($default, $ext->assetPath(''));
    }

    /** Subpath with slash is allowed. */
    public function testAssetPathAllowsSubpath(): void
    {
        $ext = new NowoIconSelectorTwigExtension();
        self::assertSame('bundles/nowoiconselector/css/theme.css', $ext->assetPath('css/theme.css'));
    }
}
