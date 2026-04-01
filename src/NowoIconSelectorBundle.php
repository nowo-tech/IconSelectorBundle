<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle;

use Nowo\IconSelectorBundle\DependencyInjection\Compiler\TwigPathsPass;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpKernel\Bundle\Bundle;

/**
 * Icon selector form type bundle.
 *
 * Provides a form widget to select an icon (grid, search, or dropdown mode).
 * Selected value is stored as an icon identifier string (e.g. heroicons-outline:home).
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final class NowoIconSelectorBundle extends Bundle
{
    /**
     * Registers compiler passes used by the bundle.
     *
     * Adds TwigPathsPass so bundle templates are registered in Twig's native loader
     * while still allowing application overrides under templates/bundles to win.
     */
    public function build(ContainerBuilder $container): void
    {
        $container->addCompilerPass(new TwigPathsPass());
    }
}
