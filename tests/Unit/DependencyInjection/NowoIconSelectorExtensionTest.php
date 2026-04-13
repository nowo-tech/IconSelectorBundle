<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\DependencyInjection;

use Nowo\IconSelectorBundle\DependencyInjection\Configuration;
use Nowo\IconSelectorBundle\DependencyInjection\NowoIconSelectorExtension;
use Nowo\IconSelectorBundle\Service\IconifyCollectionLoader;
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

    /** Asserts prepend() does not fail when Twig extension is not registered. */
    public function testPrependSkipsWhenTwigNotLoaded(): void
    {
        $container = new ContainerBuilder();
        $extension = new NowoIconSelectorExtension();
        $extension->prepend($container);
        self::assertFalse($container->hasExtension('twig'));
    }
}
