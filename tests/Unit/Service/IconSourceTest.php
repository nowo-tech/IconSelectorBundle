<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Service;

use Nowo\IconSelectorBundle\Service\IconSetPrefixes;
use Nowo\IconSelectorBundle\Service\IconSource;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(IconSource::class)]
#[CoversClass(IconSetPrefixes::class)]
final class IconSourceTest extends TestCase
{
    public function testResolveDefaultsFollowUseIconifyCollection(): void
    {
        self::assertSame(IconSource::Bundle, IconSource::resolve(null, false));
        self::assertSame(IconSource::Iconify, IconSource::resolve(null, true));
        self::assertSame(IconSource::Bundle, IconSource::resolve('unknown', false));
    }

    public function testExplicitSourceWins(): void
    {
        self::assertSame(IconSource::UxIconsLocal, IconSource::resolve('ux_icons_local', true));
        self::assertSame(IconSource::Bundle, IconSource::resolve('bundle', true));
        self::assertSame(IconSource::Iconify, IconSource::resolve('iconify', false));
    }

    public function testOnlyIconifyUsesTheBrowserIconifyApi(): void
    {
        self::assertTrue(IconSource::Iconify->usesBrowserIconify());
        self::assertFalse(IconSource::Bundle->usesBrowserIconify());
        self::assertFalse(IconSource::UxIconsLocal->usesBrowserIconify());
    }

    public function testSetPrefixes(): void
    {
        self::assertSame(['heroicons-outline', 'heroicons-solid'], IconSetPrefixes::forSet('heroicons'));
        self::assertSame(['bi'], IconSetPrefixes::forSet('bootstrap-icons'));
        self::assertSame(['tabler'], IconSetPrefixes::forSet('tabler'));
        self::assertSame(['tabler', 'bi'], IconSetPrefixes::forSets(['tabler', 'bootstrap-icons', 'tabler']));
    }
}
