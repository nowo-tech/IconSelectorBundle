<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\DependencyInjection;

use Symfony\Component\Config\FileLocator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\Extension;
use Symfony\Component\DependencyInjection\Extension\PrependExtensionInterface;
use Symfony\Component\DependencyInjection\Loader\YamlFileLoader;

/**
 * Loads bundle configuration and services.
 *
 * Registers parameters from nowo_icon_selector config and conditionally loads
 * Iconify collection services. Prepends the form theme to Twig according to form_theme config.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final class NowoIconSelectorExtension extends Extension implements PrependExtensionInterface
{
    /** @var array<string, string> Map form_theme config value to bundle theme path. */
    private const FORM_THEME_MAP = [
        'form_div_layout.html.twig'               => '@NowoIconSelectorBundle/Form/icon_selector_theme.html.twig',
        'form_table_layout.html.twig'             => '@NowoIconSelectorBundle/Form/icon_selector_theme_table.html.twig',
        'bootstrap_5_layout.html.twig'            => '@NowoIconSelectorBundle/Form/icon_selector_theme_bootstrap5.html.twig',
        'bootstrap_5_horizontal_layout.html.twig' => '@NowoIconSelectorBundle/Form/icon_selector_theme_bootstrap5_horizontal.html.twig',
        'bootstrap_4_layout.html.twig'            => '@NowoIconSelectorBundle/Form/icon_selector_theme_bootstrap4.html.twig',
        'bootstrap_4_horizontal_layout.html.twig' => '@NowoIconSelectorBundle/Form/icon_selector_theme_bootstrap4_horizontal.html.twig',
        'bootstrap_3_layout.html.twig'            => '@NowoIconSelectorBundle/Form/icon_selector_theme_bootstrap3.html.twig',
        'bootstrap_3_horizontal_layout.html.twig' => '@NowoIconSelectorBundle/Form/icon_selector_theme_bootstrap3_horizontal.html.twig',
        'foundation_5_layout.html.twig'           => '@NowoIconSelectorBundle/Form/icon_selector_theme_foundation5.html.twig',
        'foundation_6_layout.html.twig'           => '@NowoIconSelectorBundle/Form/icon_selector_theme_foundation6.html.twig',
        'tailwind_2_layout.html.twig'             => '@NowoIconSelectorBundle/Form/icon_selector_theme_tailwind2.html.twig',
    ];

    /**
     * Loads services and sets bundle parameters from configuration.
     *
     * @param array<int, array<string, mixed>> $configs List of configuration arrays (e.g. from config files)
     */
    public function load(array $configs, ContainerBuilder $container): void
    {
        $loader = new YamlFileLoader($container, new FileLocator(__DIR__ . '/../Resources/config'));
        $loader->load('services.yaml');

        $config = $this->processConfiguration(new Configuration(), $configs);

        $container->setParameter(Configuration::ALIAS . '.icon_sets', $config['icon_sets'] ?? ['heroicons', 'bootstrap-icons']);
        $container->setParameter(Configuration::ALIAS . '.use_iconify_collection', $config['use_iconify_collection'] ?? false);
        $container->setParameter(Configuration::ALIAS . '.icons_api_path', $config['icons_api_path'] ?? '/api/icon-selector/icons');
        $container->setParameter(Configuration::ALIAS . '.form_theme', $config['form_theme'] ?? 'form_div_layout.html.twig');
        $container->setParameter(Configuration::ALIAS . '.debug', $config['debug'] ?? false);

        if (!empty($config['use_iconify_collection'])) {
            $loader->load('services_iconify.yaml');
        }
    }

    /**
     * Prepends the bundle form theme to twig.form_themes so the icon selector widget is used.
     * The bundle's view path is registered via TwigPathsPass (at the end of the loader) so that
     * application overrides in templates/bundles/NowoIconSelectorBundle/ take precedence.
     *
     * @param ContainerBuilder $container Container builder
     */
    public function prepend(ContainerBuilder $container): void
    {
        if (!$container->hasExtension('twig')) {
            return;
        }

        $configs   = $container->getExtensionConfig(Configuration::ALIAS);
        $config    = $this->processConfiguration(new Configuration(), $configs);
        $formTheme = $config['form_theme'] ?? 'form_div_layout.html.twig';
        $themePath = self::FORM_THEME_MAP[$formTheme] ?? self::FORM_THEME_MAP['form_div_layout.html.twig'];

        $container->prependExtensionConfig('twig', [
            'form_themes' => [$themePath],
        ]);
    }

    /**
     * Returns the extension alias used in config (nowo_icon_selector).
     *
     * @return string Extension alias
     */
    public function getAlias(): string
    {
        return Configuration::ALIAS;
    }
}
