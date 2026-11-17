<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Service;

use Nowo\IconSelectorBundle\Service\LocalUxIconsScanner;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

use function dirname;

/**
 * The local UX Icons catalogue (source ux_icons_local) lists committed SVG files as prefix:name ids.
 */
#[CoversClass(LocalUxIconsScanner::class)]
final class LocalUxIconsScannerTest extends TestCase
{
    private function fixtureDir(): string
    {
        return dirname(__DIR__, 2) . '/Fixtures/ux-icons';
    }

    public function testListsPrefixedSvgFilesSortedAndSkipsInvalidNames(): void
    {
        $icons = (new LocalUxIconsScanner($this->fixtureDir()))->listIcons();

        self::assertSame([
            'bi:house',
            'flags:eu:es',
            'heroicons-outline:home',
            'tabler:home',
            'tabler:star',
            'tabler:user-circle',
        ], $icons);
    }

    public function testRestrictsToPrefixes(): void
    {
        $scanner = new LocalUxIconsScanner($this->fixtureDir() . '/');

        self::assertSame(['tabler:home', 'tabler:star', 'tabler:user-circle'], $scanner->listIcons(['tabler']));
        self::assertSame(['bi:house', 'flags:eu:es'], $scanner->listIcons(['bi', 'flags']));
        self::assertSame([], $scanner->listIcons([]));
    }

    public function testMissingOrEmptyDirectoryListsNothing(): void
    {
        self::assertSame([], (new LocalUxIconsScanner(''))->listIcons());
        self::assertSame([], (new LocalUxIconsScanner($this->fixtureDir() . '/does-not-exist'))->listIcons());
    }
}
