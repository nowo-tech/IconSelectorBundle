<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\DependencyInjection;

use Nowo\IconSelectorBundle\Emoji\EmojiCatalog;
use Nowo\IconSelectorBundle\Emoji\EmojiCatalogInterface;
use Nowo\IconSelectorBundle\Service\IconSource;
use Nowo\IconSelectorBundle\Validator\Constraints\EmojiIconValidator;
use Symfony\Component\Asset\Package;
use Symfony\Component\Config\FileLocator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\Extension;
use Symfony\Component\DependencyInjection\Extension\PrependExtensionInterface;
use Symfony\Component\DependencyInjection\Loader\YamlFileLoader;
use Symfony\Component\DependencyInjection\Reference;
use Symfony\Component\Validator\ConstraintValidator;

use function class_exists;
use function is_string;
use function rawurlencode;

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
        $container->setParameter(Configuration::ALIAS . '.iconify_http_timeout', $config['iconify_http_timeout'] ?? 15.0);
        $container->setParameter(Configuration::ALIAS . '.icons_api_path', $config['icons_api_path'] ?? '/api/icon-selector/icons');
        $container->setParameter(Configuration::ALIAS . '.form_theme', $config['form_theme'] ?? 'form_div_layout.html.twig');
        $container->setParameter(Configuration::ALIAS . '.debug', $config['debug'] ?? false);
        $source = IconSource::resolve($config['source'] ?? null, (bool) ($config['use_iconify_collection'] ?? false));
        $container->setParameter(Configuration::ALIAS . '.source', $source->value);
        $container->setParameter(Configuration::ALIAS . '.ux_icons_dir', $config['ux_icons_dir'] ?? $this->defaultUxIconsDir($container));
        $container->setParameter(Configuration::ALIAS . '.include_stylesheet', $config['include_stylesheet'] ?? true);
        $container->setParameter(Configuration::ALIAS . '.stylesheet_nonce', $config['stylesheet_nonce'] ?? false);
        $container->setParameter(
            Configuration::ALIAS . '.emoji_data_url',
            $config['emoji_data_url'] ?? '/bundles/nowoiconselector/emoji-data.json?v=' . rawurlencode((new EmojiCatalog())->getVersion()),
        );

        // The EmojiIcon constraint validator is registered only when symfony/validator is installed (optional).
        if (class_exists(ConstraintValidator::class)) {
            $container->register(EmojiIconValidator::class, EmojiIconValidator::class)
                ->setArgument('$catalog', new Reference(EmojiCatalogInterface::class))
                ->addTag('validator.constraint_validator');
        }

        // ux_icons_local never uses the Iconify collections: the list is the committed SVG files only.
        if (!empty($config['use_iconify_collection']) && $source !== IconSource::UxIconsLocal) {
            $loader->load('services_iconify.yaml');
        }
    }

    /**
     * Default directory for source ux_icons_local when neither ux_icons_dir nor ux_icons.icon_dir is set (the
     * ux_icons.icon_dir case is handled in prepend(): load() only sees this extension's configuration).
     *
     * @param ContainerBuilder $container Container builder
     *
     * @return string %kernel.project_dir%/assets/icons (the UX Icons default); empty without a kernel
     */
    private function defaultUxIconsDir(ContainerBuilder $container): string
    {
        // Outside a kernel (bare container) there is no project dir: no local directory, the scanner lists nothing.
        return $container->hasParameter('kernel.project_dir') ? '%kernel.project_dir%/assets/icons' : '';
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
        $configs   = $container->getExtensionConfig(Configuration::ALIAS);
        $config    = $this->processConfiguration(new Configuration(), $configs);
        $formTheme = $config['form_theme'] ?? 'form_div_layout.html.twig';
        $themePath = self::FORM_THEME_MAP[$formTheme] ?? self::FORM_THEME_MAP['form_div_layout.html.twig'];

        // Source ux_icons_local scans the same directory as UX Icons: copy ux_icons.icon_dir unless ux_icons_dir is set.
        if ($config['ux_icons_dir'] === null) {
            $iconDir = null;
            foreach ($container->getExtensionConfig('ux_icons') as $uxConfig) {
                if (isset($uxConfig['icon_dir']) && is_string($uxConfig['icon_dir']) && $uxConfig['icon_dir'] !== '') {
                    $iconDir = $uxConfig['icon_dir'];
                }
            }
            if ($iconDir !== null) {
                $container->prependExtensionConfig(Configuration::ALIAS, ['ux_icons_dir' => $iconDir]);
            }
        }

        if ($container->hasExtension('twig')) {
            $container->prependExtensionConfig('twig', [
                'form_themes' => [$themePath],
            ]);
        }

        // The asset package needs symfony/asset (optional): without it FrameworkBundle would reject assets config.
        if ($container->hasExtension('framework') && class_exists(Package::class)) {
            $container->prependExtensionConfig('framework', [
                'assets' => [
                    'packages' => [
                        Configuration::ALIAS => [
                            'base_path' => '/bundles/nowoiconselector',
                        ],
                    ],
                ],
            ]);
        }
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
