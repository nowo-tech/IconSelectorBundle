<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Service;

use Nowo\IconSelectorBundle\Service\IconifyCollectionLoader;
use PHPUnit\Framework\TestCase;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

/**
 * Unit tests for IconifyCollectionLoader.
 *
 * @covers \Nowo\IconSelectorBundle\Service\IconifyCollectionLoader
 */
final class IconifyCollectionLoaderTest extends TestCase
{
    public function testGetIconsForSetUsesDefaultMapping(): void
    {
        $cache = $this->createMock(CacheInterface::class);
        $cache->method('get')->willReturnCallback(static fn (string $key, callable $callback): array => $callback());
        $response = $this->createMock(ResponseInterface::class);
        $response->method('getStatusCode')->willReturn(200);
        $response->method('toArray')->willReturn([
            'uncategorized' => ['home', 'user'],
            'categories'    => [['arrow-right'], ['star']],
        ]);
        $http = $this->createMock(HttpClientInterface::class);
        $http->method('request')->willReturn($response);

        $loader = new IconifyCollectionLoader($http, $cache);
        $icons  = $loader->getIconsForSet('heroicons');

        self::assertContains('heroicons-outline:home', $icons);
        self::assertContains('heroicons-outline:user', $icons);
        self::assertContains('heroicons-outline:arrow-right', $icons);
        self::assertContains('heroicons-outline:star', $icons);
        self::assertContains('heroicons-solid:home', $icons);
        self::assertSame($icons, array_values(array_unique($icons)));
    }

    public function testGetIconsForPrefixReturnsEmptyOnNon200(): void
    {
        $cache = $this->createMock(CacheInterface::class);
        $cache->method('get')->willReturnCallback(static fn (string $key, callable $callback): array => $callback());
        $response = $this->createMock(ResponseInterface::class);
        $response->method('getStatusCode')->willReturn(404);
        $http = $this->createMock(HttpClientInterface::class);
        $http->method('request')->willReturn($response);

        $loader = new IconifyCollectionLoader($http, $cache);
        $icons  = $loader->getIconsForSet('unknown-prefix');

        self::assertSame([], $icons);
    }

    public function testGetIconsForSetWithCustomSetMapping(): void
    {
        $cache = $this->createMock(CacheInterface::class);
        $cache->method('get')->willReturnCallback(static fn (string $key, callable $callback): array => $callback());
        $response = $this->createMock(ResponseInterface::class);
        $response->method('getStatusCode')->willReturn(200);
        $response->method('toArray')->willReturn(['uncategorized' => ['custom-icon']]);
        $http = $this->createMock(HttpClientInterface::class);
        $http->method('request')->willReturn($response);

        $loader = new IconifyCollectionLoader($http, $cache, ['my-set' => ['my-prefix']]);
        $icons  = $loader->getIconsForSet('my-set');

        self::assertContains('my-prefix:custom-icon', $icons);
    }

    public function testGetIconsForPrefixSkipsNonStringNamesInCategories(): void
    {
        $cache = $this->createMock(CacheInterface::class);
        $cache->method('get')->willReturnCallback(static fn (string $key, callable $callback): array => $callback());
        $response = $this->createMock(ResponseInterface::class);
        $response->method('getStatusCode')->willReturn(200);
        $response->method('toArray')->willReturn([
            'uncategorized' => ['valid'],
            'categories'    => [['ok'], [123, null]], // non-strings skipped
        ]);
        $http = $this->createMock(HttpClientInterface::class);
        $http->method('request')->willReturn($response);

        $loader = new IconifyCollectionLoader($http, $cache);
        $icons  = $loader->getIconsForSet('bi');

        self::assertContains('bi:valid', $icons);
        self::assertContains('bi:ok', $icons);
        self::assertCount(2, $icons);
    }

    /** Categories with a non-array element is skipped (continue). */
    public function testGetIconsForPrefixSkipsNonArrayCategory(): void
    {
        $cache = $this->createMock(CacheInterface::class);
        $cache->method('get')->willReturnCallback(static fn (string $key, callable $callback): array => $callback());
        $response = $this->createMock(ResponseInterface::class);
        $response->method('getStatusCode')->willReturn(200);
        $response->method('toArray')->willReturn([
            'uncategorized' => ['only'],
            'categories'    => ['not-an-array', ['real']],
        ]);
        $http = $this->createMock(HttpClientInterface::class);
        $http->method('request')->willReturn($response);

        $loader = new IconifyCollectionLoader($http, $cache);
        $icons  = $loader->getIconsForSet('bi');

        self::assertContains('bi:only', $icons);
        self::assertContains('bi:real', $icons);
        self::assertCount(2, $icons);
    }
}
