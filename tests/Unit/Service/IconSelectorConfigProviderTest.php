<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Service;

use Nowo\IconSelectorBundle\Service\IconSelectorConfigProvider;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for IconSelectorConfigProvider.
 *
 * @covers \Nowo\IconSelectorBundle\Service\IconSelectorConfigProvider
 */
final class IconSelectorConfigProviderTest extends TestCase
{
    public function testGetConfigReturnsIconifyBaseAndSets(): void
    {
        $provider = new IconSelectorConfigProvider(['heroicons', 'bootstrap-icons']);
        $config   = $provider->getConfig();

        self::assertSame('https://api.iconify.design', $config['iconify_base']);
        self::assertCount(2, $config['sets']);
        self::assertSame('heroicons', $config['sets'][0]['key']);
        self::assertSame('Heroicons', $config['sets'][0]['label']);
        self::assertSame(['heroicons-outline', 'heroicons-solid'], $config['sets'][0]['prefixes']);
        self::assertSame('bootstrap-icons', $config['sets'][1]['key']);
        self::assertSame('Bootstrap Icons', $config['sets'][1]['label']);
        self::assertSame(['bi'], $config['sets'][1]['prefixes']);
    }

    public function testGetConfigReturnsEmptySetsWhenNoIconSets(): void
    {
        $provider = new IconSelectorConfigProvider([]);
        $config   = $provider->getConfig();

        self::assertSame([], $config['sets']);
    }

    /** Unknown set key uses humanized label (e.g. "my-set" → "My Set"). */
    public function testGetConfigHumanizesUnknownSetKey(): void
    {
        $provider = new IconSelectorConfigProvider(['my-custom-set']);
        $config   = $provider->getConfig();

        self::assertCount(1, $config['sets']);
        self::assertSame('my-custom-set', $config['sets'][0]['key']);
        self::assertSame('My Custom Set', $config['sets'][0]['label']);
        self::assertSame(['my-custom-set'], $config['sets'][0]['prefixes']);
    }
}
