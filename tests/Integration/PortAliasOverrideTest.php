<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Integration;

use Nowo\IconSelectorBundle\Controller\Api\IconListController;
use Nowo\IconSelectorBundle\DependencyInjection\NowoIconSelectorExtension;
use Nowo\IconSelectorBundle\Service\IconCatalogInterface;
use Nowo\IconSelectorBundle\Service\IconListProvider;
use Nowo\IconSelectorBundle\Service\IconSelectorConfigProvider;
use Nowo\IconSelectorBundle\Service\IconSelectorConfigProviderInterface;
use Nowo\IconSelectorBundle\Service\SvgSanitizer;
use Nowo\IconSelectorBundle\Service\SvgSanitizerInterface;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;

use function array_keys;
use function in_array;
use function json_decode;

/**
 * REQ-ARCH-001 rules 1 and 5: the icon API endpoints read through IconCatalogInterface, so a host can serve its own
 * catalogue by overriding one alias.
 */
final class PortAliasOverrideTest extends TestCase
{
    public function testPortsAreAliasedToTheShippedServices(): void
    {
        $container = $this->container();

        self::assertSame(IconListProvider::class, (string) $container->getAlias(IconCatalogInterface::class));
        self::assertSame(IconSelectorConfigProvider::class, (string) $container->getAlias(IconSelectorConfigProviderInterface::class));
        self::assertSame(SvgSanitizer::class, (string) $container->getAlias(SvgSanitizerInterface::class));
    }

    public function testTheListEndpointServesAHostCatalogue(): void
    {
        $container = $this->container();
        $container->register('app.catalog', HostCatalog::class);
        $container->setAlias(IconCatalogInterface::class, 'app.catalog');
        foreach ($container->getDefinitions() as $id => $definition) {
            if (!in_array($id, [IconListController::class, 'app.catalog', 'service_container'], true)) {
                $container->removeDefinition($id);
            }
        }
        foreach (array_keys($container->getAliases()) as $id) {
            if ($id !== IconCatalogInterface::class) {
                $container->removeAlias($id);
            }
        }
        $container->getAlias(IconCatalogInterface::class)->setPublic(true);
        $container->compile();

        $controller = $container->get(IconListController::class);
        self::assertInstanceOf(IconListController::class, $controller);
        $payload = json_decode((string) $controller()->getContent(), true);

        self::assertSame(['host:one', 'host:two'], $payload['icons']);
        self::assertSame(['host' => ['host:one', 'host:two']], $payload['icons_by_set']);
    }

    private function container(): ContainerBuilder
    {
        $container = new ContainerBuilder();
        $container->setParameter('kernel.debug', false);
        $container->setParameter('kernel.environment', 'test');
        (new NowoIconSelectorExtension())->load([], $container);

        return $container;
    }
}

/** Host-side catalogue used by the override test. */
final class HostCatalog implements IconCatalogInterface
{
    public function getIcons(): array
    {
        return ['host:one', 'host:two'];
    }

    public function getIconsForSets(array $sets): array
    {
        return $this->getIcons();
    }

    public function getIconsBySet(): array
    {
        return ['host' => $this->getIcons()];
    }

    public function isValidIcon(string $iconId): bool
    {
        return in_array($iconId, $this->getIcons(), true);
    }
}
