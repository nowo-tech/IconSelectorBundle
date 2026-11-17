<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\DependencyInjection;

use Nowo\IconSelectorBundle\DependencyInjection\Configuration;
use Nowo\IconSelectorBundle\DependencyInjection\NowoIconSelectorExtension;
use Nowo\IconSelectorBundle\Emoji\EmojiCatalogInterface;
use Nowo\IconSelectorBundle\Service\IconifyCollectionLoader;
use Nowo\IconSelectorBundle\Twig\IconRenderTwigExtension;
use Nowo\IconSelectorBundle\Validator\Constraints\EmojiIconValidator;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\Extension;

/**
 * Tests for the DI extension (load, prepend, alias, parameters).
 *
 * @covers \Nowo\IconSelectorBundle\DependencyInjection\NowoIconSelectorExtension
 */
final class NowoIconSelectorExtensionTest extends TestCase
{
    /** Asserts getAlias returns the configuration alias. */
    public function testGetAlias(): void
    {
        $extension = new NowoIconSelectorExtension();
        self::assertSame(Configuration::ALIAS, $extension->getAlias());
    }

    /** Asserts load() registers bundle parameters (icon_sets, icons_api_path, form_theme). */
    public function testLoadRegistersParametersAndServices(): void
    {
        $container = new ContainerBuilder();
        $extension = new NowoIconSelectorExtension();
        $extension->load([], $container);

        self::assertTrue($container->hasParameter('nowo_icon_selector.icon_sets'));
        self::assertTrue($container->hasParameter('nowo_icon_selector.icons_api_path'));
        self::assertTrue($container->hasParameter('nowo_icon_selector.form_theme'));
        self::assertSame(['heroicons', 'bootstrap-icons'], $container->getParameter('nowo_icon_selector.icon_sets'));
        self::assertSame('/api/icon-selector/icons', $container->getParameter('nowo_icon_selector.icons_api_path'));
        $emojiUrl = $container->getParameter('nowo_icon_selector.emoji_data_url');
        self::assertIsString($emojiUrl);
        self::assertMatchesRegularExpression('#^/bundles/nowoiconselector/emoji-data\.json\?v=\d+\.\d+$#', $emojiUrl);
        self::assertTrue($container->hasDefinition(EmojiIconValidator::class));
        self::assertTrue($container->hasAlias(EmojiCatalogInterface::class));
        self::assertTrue($container->hasDefinition(IconRenderTwigExtension::class));
    }

    /** 1.8: theme auto resolves to uikit when NowoUiKitBundle is registered, else bootstrap; explicit values win. */
    public function testThemeResolution(): void
    {
        $plain = new ContainerBuilder();
        (new NowoIconSelectorExtension())->load([], $plain);
        self::assertSame('bootstrap', $plain->getParameter('nowo_icon_selector.theme'));

        $withUiKit = new ContainerBuilder();
        $withUiKit->setParameter('kernel.bundles', ['NowoUiKitBundle' => 'Nowo\\UiKitBundle\\NowoUiKitBundle']);
        (new NowoIconSelectorExtension())->load([], $withUiKit);
        self::assertSame('uikit', $withUiKit->getParameter('nowo_icon_selector.theme'));

        $forced = new ContainerBuilder();
        $forced->setParameter('kernel.bundles', ['NowoUiKitBundle' => 'Nowo\\UiKitBundle\\NowoUiKitBundle']);
        (new NowoIconSelectorExtension())->load([['theme' => 'bootstrap']], $forced);
        self::assertSame('bootstrap', $forced->getParameter('nowo_icon_selector.theme'));

        $explicit = new ContainerBuilder();
        (new NowoIconSelectorExtension())->load([['theme' => 'uikit']], $explicit);
        self::assertSame('uikit', $explicit->getParameter('nowo_icon_selector.theme'));
    }

    public function testCustomEmojiDataUrl(): void
    {
        $container = new ContainerBuilder();
        (new NowoIconSelectorExtension())->load([['emoji_data_url' => '/assets/emoji.json']], $container);

        self::assertSame('/assets/emoji.json', $container->getParameter('nowo_icon_selector.emoji_data_url'));
    }

    /** Asserts custom config is applied to container parameters. */
    public function testLoadWithCustomConfig(): void
    {
        $container = new ContainerBuilder();
        $extension = new NowoIconSelectorExtension();
        $extension->load([[
            'icon_sets'      => ['heroicons'],
            'icons_api_path' => '/my/icons',
            'form_theme'     => 'bootstrap_5_layout.html.twig',
        ]], $container);

        self::assertSame(['heroicons'], $container->getParameter('nowo_icon_selector.icon_sets'));
        self::assertSame('/my/icons', $container->getParameter('nowo_icon_selector.icons_api_path'));
        self::assertSame('bootstrap_5_layout.html.twig', $container->getParameter('nowo_icon_selector.form_theme'));
    }

    /** Asserts load() with use_iconify_collection true registers IconifyCollectionLoader. */
    public function testLoadWithUseIconifyCollectionTrueLoadsIconifyServices(): void
    {
        $container = new ContainerBuilder();
        $extension = new NowoIconSelectorExtension();
        $extension->load([['use_iconify_collection' => true]], $container);

        self::assertTrue($container->getParameter('nowo_icon_selector.use_iconify_collection'));
        self::assertTrue($container->has(IconifyCollectionLoader::class));
    }

    /** Asserts prepend() adds form_themes to Twig when Twig extension is loaded. */
    public function testPrependAddsTwigPathsWhenTwigExtensionPresent(): void
    {
        $twigExtension = new class extends Extension {
            public function load(array $configs, ContainerBuilder $container): void
            {
            }

            public function getAlias(): string
            {
                return 'twig';
            }
        };
        $container = new ContainerBuilder();
        $container->registerExtension($twigExtension);
        $container->loadFromExtension('twig', ['strict_variables' => false]);
        $container->registerExtension(new NowoIconSelectorExtension());
        $container->loadFromExtension(Configuration::ALIAS, ['form_theme' => 'form_div_layout.html.twig']);

        $extension = new NowoIconSelectorExtension();
        $extension->prepend($container);

        $twigConfig = $container->getExtensionConfig('twig');
        self::assertNotEmpty($twigConfig);
        $config = $twigConfig[0] ?? [];
        self::assertArrayHasKey('form_themes', $config);
    }

    public function testPrependAddsNamedAssetPackageWhenFrameworkExtensionPresent(): void
    {
        $frameworkExtension = new class extends Extension {
            public function load(array $configs, ContainerBuilder $container): void
            {
            }

            public function getAlias(): string
            {
                return 'framework';
            }
        };
        $container = new ContainerBuilder();
        $container->registerExtension($frameworkExtension);
        $container->loadFromExtension('framework', []);
        $container->registerExtension(new NowoIconSelectorExtension());

        $extension = new NowoIconSelectorExtension();
        $extension->prepend($container);

        $frameworkConfig = $container->getExtensionConfig('framework');
        self::assertNotEmpty($frameworkConfig);
        $config = $frameworkConfig[0] ?? [];
        self::assertSame('/bundles/nowoiconselector', $config['assets']['packages'][Configuration::ALIAS]['base_path'] ?? null);
    }

    /** Asserts prepend() uses default form theme when configured theme is not in the map. */
    public function testPrependUsesDefaultThemeWhenFormThemeUnknown(): void
    {
        $twigExtension = new class extends Extension {
            public function load(array $configs, ContainerBuilder $container): void
            {
            }

            public function getAlias(): string
            {
                return 'twig';
            }
        };
        $container = new ContainerBuilder();
        $container->registerExtension($twigExtension);
        $container->loadFromExtension('twig', []);
        $container->registerExtension(new NowoIconSelectorExtension());
        $container->loadFromExtension(Configuration::ALIAS, ['form_theme' => 'unknown_theme.html.twig']);

        $extension = new NowoIconSelectorExtension();
        $extension->prepend($container);

        $twigConfig = $container->getExtensionConfig('twig');
        self::assertNotEmpty($twigConfig);
        $config = $twigConfig[0] ?? [];
        self::assertArrayHasKey('form_themes', $config);
        self::assertContains('@NowoIconSelectorBundle/Form/icon_selector_theme.html.twig', $config['form_themes']);
    }

    /** Asserts prepend() does not fail when bundle-related extensions are not registered. */
    public function testPrependSkipsWhenKnownExtensionsNotLoaded(): void
    {
        $container = new ContainerBuilder();
        $extension = new NowoIconSelectorExtension();
        $extension->prepend($container);
        self::assertFalse($container->hasExtension('twig'));
        self::assertFalse($container->hasExtension('framework'));
    }

    public function testSourceDefaultsToBundleAndFollowsUseIconifyCollection(): void
    {
        $container = new ContainerBuilder();
        (new NowoIconSelectorExtension())->load([], $container);
        self::assertSame('bundle', $container->getParameter('nowo_icon_selector.source'));
        self::assertTrue($container->getParameter('nowo_icon_selector.include_stylesheet'));
        self::assertSame('', $container->getParameter('nowo_icon_selector.ux_icons_dir'));

        $container = new ContainerBuilder();
        (new NowoIconSelectorExtension())->load([['use_iconify_collection' => true]], $container);
        self::assertSame('iconify', $container->getParameter('nowo_icon_selector.source'));
    }

    /** ux_icons_local never loads the Iconify collection services, even with use_iconify_collection: true. */
    public function testUxIconsLocalSkipsIconifyServicesAndUsesTheUxIconsDir(): void
    {
        $container = new ContainerBuilder();
        $container->setParameter('kernel.project_dir', '/app');
        $container->prependExtensionConfig('ux_icons', ['icon_dir' => '%kernel.project_dir%/resources/icons']);
        $container->prependExtensionConfig('nowo_icon_selector', ['use_iconify_collection' => true, 'source' => 'ux_icons_local', 'include_stylesheet' => false]);
        $extension = new NowoIconSelectorExtension();
        $extension->prepend($container);
        $extension->load($container->getExtensionConfig('nowo_icon_selector'), $container);

        self::assertSame('ux_icons_local', $container->getParameter('nowo_icon_selector.source'));
        self::assertFalse($container->has(IconifyCollectionLoader::class));
        self::assertSame('%kernel.project_dir%/resources/icons', $container->getParameter('nowo_icon_selector.ux_icons_dir'));
        self::assertFalse($container->getParameter('nowo_icon_selector.include_stylesheet'));
    }

    public function testUxIconsDirDefaultsToAssetsIconsAndCanBeConfigured(): void
    {
        $container = new ContainerBuilder();
        $container->setParameter('kernel.project_dir', '/app');
        (new NowoIconSelectorExtension())->load([['source' => 'ux_icons_local']], $container);
        self::assertSame('%kernel.project_dir%/assets/icons', $container->getParameter('nowo_icon_selector.ux_icons_dir'));

        $container = new ContainerBuilder();
        $container->setParameter('kernel.project_dir', '/app');
        (new NowoIconSelectorExtension())->load([['source' => 'ux_icons_local', 'ux_icons_dir' => '/srv/icons']], $container);
        self::assertSame('/srv/icons', $container->getParameter('nowo_icon_selector.ux_icons_dir'));
    }

    /** An explicit ux_icons_dir wins over ux_icons.icon_dir (prepend adds nothing). */
    public function testPrependKeepsAnExplicitUxIconsDir(): void
    {
        $container = new ContainerBuilder();
        $container->prependExtensionConfig('ux_icons', ['icon_dir' => '/from/ux']);
        $container->prependExtensionConfig('nowo_icon_selector', ['ux_icons_dir' => '/explicit']);
        $extension = new NowoIconSelectorExtension();
        $extension->prepend($container);
        $extension->load($container->getExtensionConfig('nowo_icon_selector'), $container);

        self::assertSame('/explicit', $container->getParameter('nowo_icon_selector.ux_icons_dir'));
    }
}
