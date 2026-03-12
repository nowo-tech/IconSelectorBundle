<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Controller\Api;

use Nowo\IconSelectorBundle\Controller\Api\IconListController;
use Nowo\IconSelectorBundle\Service\IconListProvider;
use PHPUnit\Framework\TestCase;

use const JSON_THROW_ON_ERROR;

/**
 * Unit tests for the icon list API endpoint (JSON response shape and content).
 *
 * @covers \Nowo\IconSelectorBundle\Controller\Api\IconListController
 */
final class IconListControllerTest extends TestCase
{
    /** Ensures __invoke returns 200 with keys "icons" and "icons_by_set" matching the provider. */
    public function testInvokeReturnsJsonWithIconsAndIconsBySet(): void
    {
        $provider   = new IconListProvider(['heroicons', 'bootstrap-icons']);
        $controller = new IconListController($provider);
        $response   = $controller->__invoke();

        self::assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('icons', $data);
        self::assertArrayHasKey('icons_by_set', $data);
        self::assertSame($provider->getIcons(), $data['icons']);
        self::assertSame($provider->getIconsBySet(), $data['icons_by_set']);
    }
}
