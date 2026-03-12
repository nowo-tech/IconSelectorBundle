<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Controller\Api;

use Nowo\IconSelectorBundle\Controller\Api\IconConfigController;
use Nowo\IconSelectorBundle\Service\IconSelectorConfigProvider;
use PHPUnit\Framework\TestCase;

use const JSON_THROW_ON_ERROR;

/**
 * Unit tests for the widget config API endpoint.
 *
 * @covers \Nowo\IconSelectorBundle\Controller\Api\IconConfigController
 */
final class IconConfigControllerTest extends TestCase
{
    public function testReturnsConfigWithIconifyBaseAndSets(): void
    {
        $provider   = new IconSelectorConfigProvider(['heroicons', 'bootstrap-icons']);
        $controller = new IconConfigController();
        $response   = $controller->__invoke($provider);

        self::assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('https://api.iconify.design', $data['iconify_base']);
        self::assertIsArray($data['sets']);
        self::assertCount(2, $data['sets']);
        self::assertSame('heroicons', $data['sets'][0]['key']);
        self::assertSame('Heroicons', $data['sets'][0]['label']);
        self::assertSame(['heroicons-outline', 'heroicons-solid'], $data['sets'][0]['prefixes']);
        self::assertSame('bootstrap-icons', $data['sets'][1]['key']);
        self::assertSame('Bootstrap Icons', $data['sets'][1]['label']);
        self::assertSame(['bi'], $data['sets'][1]['prefixes']);
    }

    public function testReturnsEmptySetsWhenNoIconSetsConfigured(): void
    {
        $provider   = new IconSelectorConfigProvider([]);
        $controller = new IconConfigController();
        $response   = $controller->__invoke($provider);

        $data = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame([], $data['sets']);
    }
}
