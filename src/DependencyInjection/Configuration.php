<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\DependencyInjection;

use Nowo\IconSelectorBundle\Service\IconSource;
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
     * Builds the configuration tree (icon_sets, use_iconify_collection, source, ux_icons_dir, include_stylesheet, icons_api_path, form_theme, ...).
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
                    ->info('When true, the server fetches the full icon list from api.iconify.design/collection for each icon_sets entry (requires symfony/http-client). When false, the bundle static list is used. Also sets the default of "source" (true = iconify, false = bundle).')
                    ->defaultFalse()
                ->end()
                ->enumNode('source')
                    ->info('Where the picker reads the icon list and the SVG previews from. "iconify": the browser calls api.iconify.design (third-party requests). "bundle": same-origin only, from the bundle icons and SVG endpoints. "ux_icons_local": same-origin only, offering just the SVG files committed under the UX Icons directory (ux_icons_dir) whose prefix belongs to icon_sets. Null = "iconify" when use_iconify_collection is true, else "bundle".')
                    ->values([IconSource::Iconify->value, IconSource::Bundle->value, IconSource::UxIconsLocal->value])
                    ->defaultNull()
                ->end()
                ->scalarNode('ux_icons_dir')
                    ->info('Directory scanned by source "ux_icons_local". Null = the ux_icons.icon_dir setting when the host sets it, else %kernel.project_dir%/assets/icons (the UX Icons default).')
                    ->defaultNull()
                ->end()
                ->booleanNode('stylesheet_nonce')
                    ->info('When true, the stylesheet <link> carries the CSP nonce: the "csp_nonce" request attribute (nowo-tech HttpHardening convention) when present, else NelmioSecurityBundle getNonce("style"). Off by default: asking Nelmio creates a style nonce, and browsers then ignore \'unsafe-inline\' for every other inline style on the page.')
                    ->defaultFalse()
                ->end()
                ->booleanNode('include_stylesheet')
                    ->info('When true, the form theme links the bundle stylesheet (asset package nowo_icon_selector, icon-selector.css) next to each widget. Set false when your layout or asset pipeline loads icon-selector.css itself. The bundle never injects inline <style> elements or style attributes (strict CSP).')
                    ->defaultTrue()
                ->end()
                ->floatNode('iconify_http_timeout')
                    ->info('HTTP timeout in seconds for each Iconify collection API request when use_iconify_collection is true. Keep below PHP max_execution_time / FrankenPHP write timeout.')
                    ->defaultValue(15.0)
                    ->min(0.1)
                ->end()
                ->scalarNode('icons_api_path')
                    ->info('Path for the JSON API that returns available icons. Used by the frontend to fetch the list.')
                    ->defaultValue('/api/icon-selector/icons')
                ->end()
                ->scalarNode('form_theme')
                    ->info('Base form layout so the icon selector theme matches your app (e.g. form_div_layout.html.twig, bootstrap_5_layout.html.twig). Must match twig.form_themes.')
                    ->defaultValue('form_div_layout.html.twig')
                ->end()
                ->scalarNode('emoji_data_url')
                    ->info('URL of the bundled emoji dataset used by the picker when a field sets emoji: true. Null = /bundles/nowoiconselector/emoji-data.json?v=<emoji version> (after assets:install).')
                    ->defaultNull()
                ->end()
                ->booleanNode('debug')
                    ->info('When true, the frontend logs all debug/info/warn messages to the console. When false, only the initial "script loaded" message is shown.')
                    ->defaultFalse()
                ->end()
            ->end();

        return $treeBuilder;
    }
}
