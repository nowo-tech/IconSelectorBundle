<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Integration;

use Nowo\IconSelectorBundle\Tests\Kernel\HostControllersRoutesKernel;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Loader\AttributeServicesLoader;
use Symfony\Component\Routing\RouterInterface;

use function sprintf;

/**
 * REQ-SF-004 rule 7: the icon API routes are opt-in (import of the bundle routes.yaml);
 * the host's default `routing.controllers` resource must not register them.
 */
final class HostControllersRoutesTest extends TestCase
{
    private const ROUTES = [
        'nowo_icon_selector_api_icons',
        'nowo_icon_selector_api_icons_svg',
        'nowo_icon_selector_api_config',
    ];

    protected function setUp(): void
    {
        if (!class_exists(AttributeServicesLoader::class)) {
            self::markTestSkipped('The routing.controllers resource needs symfony/routing >= 7.3.');
        }
    }

    public function testBundleRoutesAreNotRegisteredWithoutTheRoutesImport(): void
    {
        $kernel = new HostControllersRoutesKernel('test', false);
        $kernel->boot();

        try {
            $routes = $this->router($kernel)->getRouteCollection();
            foreach (self::ROUTES as $name) {
                self::assertNull($routes->get($name), sprintf('Route "%s" must only exist when the host imports the bundle routes.yaml.', $name));
            }
            foreach ($routes as $name => $route) {
                self::assertStringStartsNotWith('nowo_icon_selector', $name);
            }
        } finally {
            $kernel->shutdown();
        }
    }

    public function testImportedRoutesServeTheApi(): void
    {
        $kernel = new HostControllersRoutesKernel('test', false, true);
        $kernel->boot();

        try {
            $routes = $this->router($kernel)->getRouteCollection();
            foreach (self::ROUTES as $name) {
                self::assertNotNull($routes->get($name));
            }

            $response = $kernel->handle(Request::create('/api/icon-selector/config'));
            self::assertSame(200, $response->getStatusCode());
            self::assertJson((string) $response->getContent());
        } finally {
            $kernel->shutdown();
        }
    }

    private function router(HostControllersRoutesKernel $kernel): RouterInterface
    {
        $router = $kernel->getContainer()->get('router');
        self::assertInstanceOf(RouterInterface::class, $router);

        return $router;
    }
}
