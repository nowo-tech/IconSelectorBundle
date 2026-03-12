<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Twig;

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
}
