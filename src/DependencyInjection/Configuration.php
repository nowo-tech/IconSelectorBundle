<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\DependencyInjection;

use Symfony\Component\Config\Definition\Builder\TreeBuilder;
use Symfony\Component\Config\Definition\ConfigurationInterface;

/**
 * Configuration for Icon Selector Bundle.
 *
 * Defines which icon libraries (Symfony UX Icons sets) are available in the selector,
 * API path, and form theme mapping.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final class Configuration implements ConfigurationInterface
{
    /** Configuration root key for this bundle (used in config YAML and container parameters). */
    public const ALIAS = 'nowo_icon_selector';

    /**
     * Builds the configuration tree (icon_sets, use_iconify_collection, icons_api_path, form_theme).
     *
     * @return TreeBuilder Configuration tree builder
     */
    public function getConfigTreeBuilder(): TreeBuilder
    {
        $treeBuilder = new TreeBuilder(self::ALIAS);
        $root        = $treeBuilder->getRootNode();

        $root
            ->children()
                ->arrayNode('icon_sets')
                    ->info('Icon libraries to use (Symfony UX Icons set names: heroicons, bootstrap-icons, tabler, etc.). Only these will be available in the selector.')
                    ->scalarPrototype()->end()
                    ->defaultValue(['heroicons', 'bootstrap-icons'])
                ->end()
                ->booleanNode('use_iconify_collection')
                    ->info('When true, fetch the full icon list from api.iconify.design/collection for each icon_sets entry (requires symfony/http-client). When false, use the bundle static list.')
                    ->defaultFalse()
                ->end()
                ->scalarNode('icons_api_path')
                    ->info('Path for the JSON API that returns available icons. Used by the frontend to fetch the list.')
                    ->defaultValue('/api/icon-selector/icons')
                ->end()
                ->scalarNode('form_theme')
                    ->info('Base form layout so the icon selector theme matches your app (e.g. form_div_layout.html.twig, bootstrap_5_layout.html.twig). Must match twig.form_themes.')
                    ->defaultValue('form_div_layout.html.twig')
                ->end()
            ->end();

        return $treeBuilder;
    }
}
