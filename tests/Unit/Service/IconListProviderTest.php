<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Service;

use Nowo\IconSelectorBundle\Service\IconifyCollectionLoader;
use Nowo\IconSelectorBundle\Service\IconListProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;

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
        $cache = $this->createMock(\Symfony\Contracts\Cache\CacheInterface::class);
        $cache->method('get')->willReturn(['heroicons-outline:custom', 'heroicons-solid:other']);
        $httpClient = $this->createMock(\Symfony\Contracts\HttpClient\HttpClientInterface::class);
        $loader     = new IconifyCollectionLoader($httpClient, $cache);
        $provider   = new IconListProvider(['heroicons'], true, $loader);
        $icons      = $provider->getIconsForSets(['heroicons']);

        self::assertContains('heroicons-outline:custom', $icons);
        self::assertContains('heroicons-solid:other', $icons);
    }

    /** When use_iconify_collection is true and loader throws, getIconsForSets falls back to default icons for that set. */
    public function testGetIconsForSetsFallsBackToDefaultWhenLoaderThrows(): void
    {
        $cache = $this->createMock(\Symfony\Contracts\Cache\CacheInterface::class);
        $cache->method('get')->willThrowException(new RuntimeException('API error'));
        $httpClient = $this->createMock(\Symfony\Contracts\HttpClient\HttpClientInterface::class);
        $loader     = new IconifyCollectionLoader($httpClient, $cache);
        $provider   = new IconListProvider(['heroicons'], true, $loader);
        $icons      = $provider->getIconsForSets(['heroicons']);

        self::assertContains('heroicons-outline:home', $icons);
        self::assertContains('heroicons-solid:user', $icons);
    }
}
