<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\DependencyInjection\Compiler;

use Nowo\IconSelectorBundle\DependencyInjection\Compiler\StaticIconListCheckPass;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;

#[CoversClass(StaticIconListCheckPass::class)]
final class StaticIconListCheckPassTest extends TestCase
{
    private function container(string $source, bool $iconify, mixed $sets): ContainerBuilder
    {
        $container = new ContainerBuilder();
        $container->setParameter('nowo_icon_selector.source', $source);
        $container->setParameter('nowo_icon_selector.use_iconify_collection', $iconify);
        $container->setParameter('nowo_icon_selector.icon_sets', $sets);

        return $container;
    }

    public function testLogsSetsWithoutStaticListForSourceBundle(): void
    {
        $container = $this->container('bundle', false, ['tabler', 'mdi', 'ph']);
        (new StaticIconListCheckPass())->process($container);

        $log = implode("\n", $container->getCompiler()->getLog());
        self::assertStringContainsString('icon set "mdi" has no static list', $log);
        self::assertStringContainsString('icon set "ph" has no static list', $log);
        self::assertStringNotContainsString('"tabler"', $log);
    }

    public function testNoWarningForOtherSourcesOrIconifyCollections(): void
    {
        self::assertSame([], StaticIconListCheckPass::missingSets($this->container('ux_icons_local', false, ['mdi'])));
        self::assertSame([], StaticIconListCheckPass::missingSets($this->container('iconify', false, ['mdi'])));
        self::assertSame([], StaticIconListCheckPass::missingSets($this->container('bundle', true, ['mdi'])));
        self::assertSame([], StaticIconListCheckPass::missingSets($this->container('bundle', false, 'mdi')));
        self::assertSame([], StaticIconListCheckPass::missingSets(new ContainerBuilder()));
    }
}
