<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\DependencyInjection;

use Nowo\IconSelectorBundle\DependencyInjection\Configuration;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Config\Definition\Processor;

/**
 * Tests for the bundle configuration tree (alias, defaults, custom values).
 *
 * @covers \Nowo\IconSelectorBundle\DependencyInjection\Configuration
 */
final class ConfigurationTest extends TestCase
{
    /** Expected config root key (must match Configuration::ALIAS). */
    private const ALIAS = 'nowo_icon_selector';

    /** Asserts the configuration alias constant equals the expected string. */
    public function testAliasConstant(): void
    {
        /* @phpstan-ignore staticMethod.alreadyNarrowedType (testing constant value) */
        self::assertSame('nowo_icon_selector', Configuration::ALIAS);
    }

    /** Asserts the config tree root node name matches the bundle alias. */
    public function testGetConfigTreeBuilderReturnsTreeWithAlias(): void
    {
        $config = new Configuration();
        $tree   = $config->getConfigTreeBuilder();
        self::assertSame(self::ALIAS, $tree->buildTree()->getName());
    }

    /** Asserts default icon_sets, icons_api_path and form_theme. */
    public function testProcessConfigurationWithDefaults(): void
    {
        $processor = new Processor();
        $config    = $processor->processConfiguration(new Configuration(), []);

        self::assertSame(['heroicons', 'bootstrap-icons'], $config['icon_sets']);
        self::assertSame('/api/icon-selector/icons', $config['icons_api_path']);
        self::assertSame('form_div_layout.html.twig', $config['form_theme']);
    }

    /** Asserts custom config values are processed correctly. */
    public function testProcessConfigurationWithCustomValues(): void
    {
        $processor = new Processor();
        $config    = $processor->processConfiguration(new Configuration(), [[
            'icon_sets'      => ['heroicons', 'tabler'],
            'icons_api_path' => '/custom/icons',
            'form_theme'     => 'bootstrap_5_layout.html.twig',
        ]]);

        self::assertSame(['heroicons', 'tabler'], $config['icon_sets']);
        self::assertSame('/custom/icons', $config['icons_api_path']);
        self::assertSame('bootstrap_5_layout.html.twig', $config['form_theme']);
    }
}
