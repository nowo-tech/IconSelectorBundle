<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\DependencyInjection\Compiler;

use Symfony\Component\DependencyInjection\Compiler\CompilerPassInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;

use function dirname;

/**
 * Registers the bundle's Twig views path at the end of the native loader so that
 * application overrides (templates/bundles/NowoIconSelectorBundle/) are consulted first.
 */
final class TwigPathsPass implements CompilerPassInterface
{
    private const TWIG_NAMESPACE = 'NowoIconSelectorBundle';

    /**
     * Adds the bundle views path to Twig's native filesystem loader, if available.
     *
     * @param ContainerBuilder $container Service container being compiled
     */
    public function process(ContainerBuilder $container): void
    {
        $loaderId = $this->getNativeLoaderServiceId($container);
        if ($loaderId === null) {
            return;
        }

        $viewsPath = dirname(__DIR__, 2) . '/Resources/views';

        $container->getDefinition($loaderId)
            ->addMethodCall('addPath', [$viewsPath, self::TWIG_NAMESPACE]);
    }

    /**
     * Resolves the Twig native loader service id across Symfony/Twig variants.
     *
     * @param ContainerBuilder $container Service container being compiled
     *
     * @return string|null Native loader service id, or null when not available
     */
    private function getNativeLoaderServiceId(ContainerBuilder $container): ?string
    {
        if ($container->hasAlias('twig.loader.native')) {
            $alias = $container->getAlias('twig.loader.native');

            return (string) $alias;
        }
        if ($container->hasDefinition('twig.loader.native')) {
            return 'twig.loader.native';
        }
        if ($container->hasDefinition('twig.loader.native_filesystem')) {
            return 'twig.loader.native_filesystem';
        }

        return null;
    }
}
