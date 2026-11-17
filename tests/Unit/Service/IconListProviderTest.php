<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Service;

use Nowo\IconSelectorBundle\Service\IconifyCollectionLoader;
use Nowo\IconSelectorBundle\Service\IconListProvider;
use Nowo\IconSelectorBundle\Service\LocalUxIconsScanner;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

use function dirname;

/**
 * Unit tests for IconListProvider (getIcons, getIconsBySet, getIconsForSets, isValidIcon).
 *
 * @covers \Nowo\IconSelectorBundle\Service\IconListProvider
 */
final class IconListProviderTest extends TestCase
{
    public function testGetIconsReturnsFlatListForConfiguredSets(): void
    {
        $provider = new IconListProvider(['heroicons', 'bootstrap-icons']);
        $icons    = $provider->getIcons();
        /* @phpstan-ignore staticMethod.alreadyNarrowedType (runtime check) */
        self::assertIsArray($icons);
        self::assertContains('heroicons-outline:home', $icons);
        self::assertContains('bi:house', $icons);
        self::assertSame($icons, array_values(array_unique($icons)));
    }

    public function testGetIconsReturnsOnlyRequestedSet(): void
    {
        $provider = new IconListProvider(['heroicons']);
        $icons    = $provider->getIcons();
        self::assertContains('heroicons-outline:home', $icons);
        self::assertNotContains('bi:house', $icons);
    }

    public function testGetIconsReturnsEmptyForUnknownSet(): void
    {
        $provider = new IconListProvider(['unknown-set']);
        self::assertSame([], $provider->getIcons());
    }

    public function testGetIconsBySetReturnsGroupedIcons(): void
    {
        $provider = new IconListProvider(['heroicons', 'bootstrap-icons']);
        $bySet    = $provider->getIconsBySet();
        self::assertArrayHasKey('heroicons', $bySet);
        self::assertArrayHasKey('bootstrap-icons', $bySet);
        self::assertContains('heroicons-outline:home', $bySet['heroicons']);
        self::assertContains('bi:house', $bySet['bootstrap-icons']);
    }

    public function testGetIconsBySetUnknownSetReturnsEmptyArray(): void
    {
        $provider = new IconListProvider(['unknown']);
        $bySet    = $provider->getIconsBySet();
        self::assertSame(['unknown' => []], $bySet);
    }

    public function testIsValidIconReturnsTrueForExistingIcon(): void
    {
        $provider = new IconListProvider(['heroicons']);
        self::assertTrue($provider->isValidIcon('heroicons-outline:home'));
    }

    public function testIsValidIconReturnsFalseForUnknownIcon(): void
    {
        $provider = new IconListProvider(['heroicons']);
        self::assertFalse($provider->isValidIcon('bi:house'));
        self::assertFalse($provider->isValidIcon('invalid:id'));
    }

    /** When use_iconify_collection is true and loader is set, getIconsForSets returns icons from the loader. */
    public function testGetIconsForSetsUsesLoaderWhenUseIconifyCollectionTrue(): void
    {
        $cache = $this->createMock(CacheInterface::class);
        $cache->method('get')->willReturn(['heroicons-outline:custom', 'heroicons-solid:other']);
        $httpClient = $this->createMock(HttpClientInterface::class);
        $loader     = new IconifyCollectionLoader($httpClient, $cache);
        $provider   = new IconListProvider(['heroicons'], true, $loader);
        $icons      = $provider->getIconsForSets(['heroicons']);

        self::assertContains('heroicons-outline:custom', $icons);
        self::assertContains('heroicons-solid:other', $icons);
    }

    /** When use_iconify_collection is true and loader throws, getIconsForSets falls back to default icons for that set. */
    public function testGetIconsForSetsFallsBackToDefaultWhenLoaderThrows(): void
    {
        $cache = $this->createMock(CacheInterface::class);
        $cache->method('get')->willThrowException(new RuntimeException('API error'));
        $httpClient = $this->createMock(HttpClientInterface::class);
        $loader     = new IconifyCollectionLoader($httpClient, $cache);
        $provider   = new IconListProvider(['heroicons'], true, $loader);
        $icons      = $provider->getIconsForSets(['heroicons']);

        self::assertContains('heroicons-outline:home', $icons);
        self::assertContains('heroicons-solid:user', $icons);
    }

    /** An empty Iconify collection (e.g. after an outage) falls back to the static list instead of showing no icons. */
    public function testGetIconsForSetsFallsBackToDefaultWhenLoaderReturnsEmpty(): void
    {
        $cache = $this->createMock(CacheInterface::class);
        $cache->method('get')->willReturn([]);
        $loader   = new IconifyCollectionLoader($this->createMock(HttpClientInterface::class), $cache);
        $provider = new IconListProvider(['heroicons', 'bootstrap-icons'], true, $loader);

        $icons = $provider->getIconsForSets(['heroicons', 'bootstrap-icons']);

        self::assertContains('heroicons-outline:home', $icons);
        self::assertContains('bi:house', $icons);
    }

    /** Source ux_icons_local: only committed SVG files, within the prefixes of the requested sets; no static list. */
    public function testUxIconsLocalListsOnlyCommittedIconsOfTheConfiguredSets(): void
    {
        $scanner  = new LocalUxIconsScanner(dirname(__DIR__, 2) . '/Fixtures/ux-icons');
        $provider = new IconListProvider(['tabler', 'bootstrap-icons'], false, null, 'ux_icons_local', $scanner);

        self::assertSame(['bi:house', 'tabler:home', 'tabler:star', 'tabler:user-circle'], $provider->getIcons());
        self::assertSame(['tabler' => ['tabler:home', 'tabler:star', 'tabler:user-circle'], 'bootstrap-icons' => ['bi:house']], $provider->getIconsBySet());
        self::assertSame(['heroicons-outline:home'], $provider->getIconsForSets(['heroicons']));
        self::assertTrue($provider->isValidIcon('tabler:home'));
        self::assertFalse($provider->isValidIcon('tabler:settings'), 'An icon of the static list that is not committed is not offered.');
    }

    public function testUxIconsLocalWithoutScannerListsNothing(): void
    {
        $provider = new IconListProvider(['tabler'], false, null, 'ux_icons_local');

        self::assertSame([], $provider->getIcons());
    }

    /** SA-M1: source bundle warns about a set without a static list (empty picker); other sets and sources do not. */
    public function testWarnsAboutSetsWithoutStaticListWithSourceBundle(): void
    {
        self::assertSame(['heroicons', 'bootstrap-icons', 'lucide', 'tabler'], IconListProvider::staticListSets());

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::once())->method('warning')->with(self::stringContains('no static list'), self::callback(static fn (array $c): bool => $c['set'] === 'mdi'));
        $icons = (new IconListProvider(['tabler', 'mdi'], false, null, 'bundle', null, $logger))->getIconsForSets(['mdi', 'tabler']);
        self::assertContains('tabler:home', $icons);

        $silent = $this->createMock(LoggerInterface::class);
        $silent->expects(self::never())->method('warning');
        (new IconListProvider(['mdi'], false, null, 'iconify', null, $silent))->getIcons();
    }

    public function testUxIconsLocalGroupsBySetWithOneWalk(): void
    {
        $provider = new IconListProvider(['heroicons', 'tabler', 'mdi'], false, null, 'ux_icons_local', new LocalUxIconsScanner(dirname(__DIR__, 2) . '/Fixtures/ux-icons'));

        self::assertSame([
            'heroicons' => ['heroicons-outline:home'],
            'tabler'    => ['tabler:home', 'tabler:star', 'tabler:user-circle'],
            'mdi'       => [],
        ], $provider->getIconsBySet());
        self::assertSame(['heroicons' => [], 'tabler' => [], 'mdi' => []], (new IconListProvider(['heroicons', 'tabler', 'mdi'], false, null, 'ux_icons_local'))->getIconsBySet());
    }
}
