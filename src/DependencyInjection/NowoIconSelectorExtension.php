<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\DependencyInjection;

use Symfony\Component\Config\FileLocator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\Extension;
use Symfony\Component\DependencyInjection\Extension\PrependExtensionInterface;
use Symfony\Component\DependencyInjection\Loader\YamlFileLoader;

use function dirname;

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
        'form_div_layout.html.twig'               => '@NowoIconSelector/Form/icon_selector_theme.html.twig',
        'form_table_layout.html.twig'             => '@NowoIconSelector/Form/icon_selector_theme_table.html.twig',
        'bootstrap_5_layout.html.twig'            => '@NowoIconSelector/Form/icon_selector_theme_bootstrap5.html.twig',
        'bootstrap_5_horizontal_layout.html.twig' => '@NowoIconSelector/Form/icon_selector_theme_bootstrap5_horizontal.html.twig',
        'bootstrap_4_layout.html.twig'            => '@NowoIconSelector/Form/icon_selector_theme_bootstrap4.html.twig',
        'bootstrap_4_horizontal_layout.html.twig' => '@NowoIconSelector/Form/icon_selector_theme_bootstrap4_horizontal.html.twig',
        'bootstrap_3_layout.html.twig'            => '@NowoIconSelector/Form/icon_selector_theme_bootstrap3.html.twig',
        'bootstrap_3_horizontal_layout.html.twig' => '@NowoIconSelector/Form/icon_selector_theme_bootstrap3_horizontal.html.twig',
        'foundation_5_layout.html.twig'           => '@NowoIconSelector/Form/icon_selector_theme_foundation5.html.twig',
        'foundation_6_layout.html.twig'           => '@NowoIconSelector/Form/icon_selector_theme_foundation6.html.twig',
        'tailwind_2_layout.html.twig'             => '@NowoIconSelector/Form/icon_selector_theme_tailwind2.html.twig',
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

        if (!empty($config['use_iconify_collection'])) {
            $loader->load('services_iconify.yaml');
        }
    }

    /**
     * Prepends Twig paths and form themes so the icon selector theme is applied.
     * Registers the bundle views path and adds the matching form theme to twig.form_themes.
     *
     * @param ContainerBuilder $container Container builder
     */
    public function prepend(ContainerBuilder $container): void
    {
        $viewsPath = dirname(__DIR__, 2) . '/src/Resources/views';
        if (!$container->hasExtension('twig')) {
            return;
        }

        $configs   = $container->getExtensionConfig(Configuration::ALIAS);
        $config    = $this->processConfiguration(new Configuration(), $configs);
        $formTheme = $config['form_theme'] ?? 'form_div_layout.html.twig';
        $themePath = self::FORM_THEME_MAP[$formTheme] ?? self::FORM_THEME_MAP['form_div_layout.html.twig'];

        $container->prependExtensionConfig('twig', [
            'paths'       => [$viewsPath => 'NowoIconSelector'],
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
