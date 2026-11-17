<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Service;

use Nowo\IconSelectorBundle\Service\LocalUxIconsScanner;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

use function dirname;
use function function_exists;

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

    public function testGroupsByPrefixAndWalksOnlyRequestedPrefixes(): void
    {
        $scanner = new LocalUxIconsScanner($this->fixtureDir());

        self::assertSame(
            ['bi' => ['bi:house'], 'tabler' => ['tabler:home', 'tabler:star', 'tabler:user-circle']],
            $scanner->listIconsByPrefix(['tabler', 'bi', 'missing', '../tabler', 'Bad_Dir']),
        );
    }

    /** SA-L1: an unreadable subdirectory is skipped; the other icons are still listed. */
    public function testUnreadableSubdirectoryIsSkipped(): void
    {
        if (function_exists('posix_geteuid') && posix_geteuid() === 0) {
            self::markTestSkipped('Directory permissions are not enforced for root.');
        }
        $dir = sys_get_temp_dir() . '/nowo-icon-scanner-' . bin2hex(random_bytes(4));
        mkdir($dir . '/tabler/locked', 0o777, true);
        file_put_contents($dir . '/tabler/home.svg', '<svg/>');
        file_put_contents($dir . '/tabler/locked/x.svg', '<svg/>');
        mkdir($dir . '/closed', 0o777, true);
        file_put_contents($dir . '/closed/y.svg', '<svg/>');
        chmod($dir . '/tabler/locked', 0o000);
        chmod($dir . '/closed', 0o000);

        try {
            $scanner = new LocalUxIconsScanner($dir);
            self::assertSame(['tabler:home'], $scanner->listIcons(['tabler', 'closed']));
            self::assertSame(['tabler:home'], $scanner->listIcons());
        } finally {
            chmod($dir . '/tabler/locked', 0o755);
            chmod($dir . '/closed', 0o755);
            unlink($dir . '/tabler/locked/x.svg');
            unlink($dir . '/closed/y.svg');
            unlink($dir . '/tabler/home.svg');
            rmdir($dir . '/tabler/locked');
            rmdir($dir . '/closed');
            rmdir($dir . '/tabler');
            rmdir($dir);
        }
    }
}
