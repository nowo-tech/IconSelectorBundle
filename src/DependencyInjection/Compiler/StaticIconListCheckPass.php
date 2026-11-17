<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\DependencyInjection\Compiler;

use Nowo\IconSelectorBundle\Service\IconListProvider;
use Nowo\IconSelectorBundle\Service\IconSource;
use Symfony\Component\DependencyInjection\Compiler\CompilerPassInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;

use function array_diff;
use function array_filter;
use function array_values;
use function implode;
use function is_array;
use function is_string;
use function sprintf;

/**
 * Container-build warning (compiler log): with source bundle and use_iconify_collection false, an icon set without
 * a bundled static list (only heroicons, bootstrap-icons, lucide and tabler have one) gives an empty picker.
 * Build time only: a runtime log line would repeat on every list call (and keeping a per-request flag would be
 * request state, unwanted in worker mode).
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final class StaticIconListCheckPass implements CompilerPassInterface
{
    public function process(ContainerBuilder $container): void
    {
        foreach (self::missingSets($container) as $set) {
            $container->log($this, sprintf(
                'nowo_icon_selector: icon set "%s" has no static list (bundled: %s); with source "bundle" its picker is empty. '
                . 'Set source: ux_icons_local (committed icons) or source: iconify / use_iconify_collection: true.',
                $set,
                implode(', ', IconListProvider::staticListSets()),
            ));
        }
    }

    /**
     * Configured sets that have no static list while the effective source is bundle without Iconify collections.
     *
     * @return list<string>
     */
    public static function missingSets(ContainerBuilder $container): array
    {
        if (!$container->hasParameter('nowo_icon_selector.source')
            || $container->getParameter('nowo_icon_selector.source') !== IconSource::Bundle->value
            || $container->getParameter('nowo_icon_selector.use_iconify_collection') === true) {
            return [];
        }
        $sets = $container->getParameter('nowo_icon_selector.icon_sets');
        if (!is_array($sets)) {
            return [];
        }
        $sets = array_values(array_filter($sets, is_string(...)));

        return array_values(array_diff($sets, IconListProvider::staticListSets()));
    }
}
