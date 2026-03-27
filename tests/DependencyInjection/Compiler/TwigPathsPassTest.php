<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\DependencyInjection\Compiler;

use Nowo\IconSelectorBundle\DependencyInjection\Compiler\TwigPathsPass;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Alias;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Definition;

use function dirname;

final class TwigPathsPassTest extends TestCase
{
    public function testProcessAddsViewsPathWhenNativeLoaderAliasExists(): void
    {
        $container = new ContainerBuilder();
        $container->setAlias('twig.loader.native', new Alias('twig.loader.native_filesystem'));
        $container->setDefinition('twig.loader.native_filesystem', new Definition());

        (new TwigPathsPass())->process($container);

        $calls = $container->getDefinition('twig.loader.native_filesystem')->getMethodCalls();
        self::assertNotEmpty($calls);
        self::assertSame('addPath', $calls[0][0]);
        self::assertSame(
            [dirname(__DIR__, 3) . '/src/Resources/views', 'NowoIconSelectorBundle'],
            $calls[0][1]
        );
    }

    public function testProcessAddsViewsPathWhenNativeLoaderDefinitionExists(): void
    {
        $container = new ContainerBuilder();
        $container->setDefinition('twig.loader.native', new Definition());

        (new TwigPathsPass())->process($container);

        $calls = $container->getDefinition('twig.loader.native')->getMethodCalls();
        self::assertNotEmpty($calls);
        self::assertSame('addPath', $calls[0][0]);
    }

    public function testProcessSkipsWhenNoKnownTwigLoaderServiceExists(): void
    {
        $container = new ContainerBuilder();
        (new TwigPathsPass())->process($container);

        self::assertFalse($container->hasDefinition('twig.loader.native'));
        self::assertFalse($container->hasDefinition('twig.loader.native_filesystem'));
    }
}
