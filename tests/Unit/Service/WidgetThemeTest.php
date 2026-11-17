<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Service;

use Nowo\IconSelectorBundle\Service\WidgetTheme;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(WidgetTheme::class)]
final class WidgetThemeTest extends TestCase
{
    public function testResolve(): void
    {
        self::assertSame(WidgetTheme::Bootstrap, WidgetTheme::resolve(null, false));
        self::assertSame(WidgetTheme::UiKit, WidgetTheme::resolve(null, true));
        self::assertSame(WidgetTheme::UiKit, WidgetTheme::resolve('auto', true));
        self::assertSame(WidgetTheme::Bootstrap, WidgetTheme::resolve('auto', false));
        self::assertSame(WidgetTheme::Bootstrap, WidgetTheme::resolve('bootstrap', true));
        self::assertSame(WidgetTheme::UiKit, WidgetTheme::resolve('uikit', false));
        self::assertSame(WidgetTheme::Bootstrap, WidgetTheme::resolve('unknown', false));
    }

    public function testUiKitIn(): void
    {
        self::assertTrue(WidgetTheme::uiKitIn(['NowoUiKitBundle' => 'X']));
        self::assertFalse(WidgetTheme::uiKitIn(['FrameworkBundle' => 'X']));
        self::assertFalse(WidgetTheme::uiKitIn([]));
    }
}
