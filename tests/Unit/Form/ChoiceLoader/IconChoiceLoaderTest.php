<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Form\ChoiceLoader;

use Nowo\IconSelectorBundle\Emoji\EmojiCatalog;
use Nowo\IconSelectorBundle\Form\ChoiceLoader\IconChoiceLoader;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\UX\Icons\IconRendererInterface;

/**
 * Unit tests for IconChoiceLoader (loadChoiceList, loadChoicesForValues with/without renderer).
 *
 * @covers \Nowo\IconSelectorBundle\Form\ChoiceLoader\IconChoiceLoader
 */
final class IconChoiceLoaderTest extends TestCase
{
    public function testLoadChoiceListReturnsChoicesFromConstructor(): void
    {
        $choices = [
            'heroicons-outline:home' => 'home',
            'bi:house'               => 'house',
        ];
        $loader = new IconChoiceLoader($choices);
        $list   = $loader->loadChoiceList();

        $loaded = $list->getChoices();
        self::assertContains('heroicons-outline:home', $loaded);
        self::assertContains('bi:house', $loaded);
        self::assertCount(2, $loaded);
    }

    public function testLoadChoicesForValuesReturnsValuesInList(): void
    {
        $choices = [
            'heroicons-outline:home' => 'home',
            'bi:house'               => 'house',
        ];
        $loader = new IconChoiceLoader($choices);

        $result = $loader->loadChoicesForValues(['heroicons-outline:home', 'bi:house']);

        self::assertSame(['heroicons-outline:home', 'bi:house'], $result);
    }

    public function testLoadChoicesForValuesAcceptsValidFormatWhenNoRenderer(): void
    {
        $choices = ['heroicons-outline:home' => 'home'];
        $loader  = new IconChoiceLoader($choices);

        $result = $loader->loadChoicesForValues(['heroicons-outline:archive']);

        self::assertSame([0 => 'heroicons-outline:archive'], $result);
    }

    public function testLoadChoicesForValuesRejectsInvalidFormatWhenNoRenderer(): void
    {
        $choices = ['heroicons-outline:home' => 'home'];
        $loader  = new IconChoiceLoader($choices);

        $result = $loader->loadChoicesForValues(['no-colon', 'single:', ':onlyprefix', '']);

        self::assertSame([], $result);
    }

    public function testLoadChoicesForValuesWithRendererAcceptsWhenRenderReturnsNonEmpty(): void
    {
        $choices  = ['heroicons-outline:home' => 'home'];
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->method('renderIcon')->with('heroicons-outline:archive', [])->willReturn('<svg>ok</svg>');
        $loader = new IconChoiceLoader($choices, $renderer);

        $result = $loader->loadChoicesForValues(['heroicons-outline:archive']);

        self::assertSame([0 => 'heroicons-outline:archive'], $result);
    }

    public function testLoadChoicesForValuesWithRendererRejectsWhenRenderReturnsEmpty(): void
    {
        $choices  = ['heroicons-outline:home' => 'home'];
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->method('renderIcon')->with('unknown:icon', [])->willReturn('');
        $loader = new IconChoiceLoader($choices, $renderer);

        $result = $loader->loadChoicesForValues(['unknown:icon']);

        self::assertSame([], $result);
    }

    public function testLoadChoicesForValuesWithRendererRejectsWhenRenderThrows(): void
    {
        $choices  = ['heroicons-outline:home' => 'home'];
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->method('renderIcon')->with('bad:icon', [])->willThrowException(new RuntimeException('Not found'));
        $loader = new IconChoiceLoader($choices, $renderer);

        $result = $loader->loadChoicesForValues(['bad:icon']);

        self::assertSame([], $result);
    }

    public function testLoadChoicesForValuesSkipsEmptyString(): void
    {
        $choices = ['heroicons-outline:home' => 'home'];
        $loader  = new IconChoiceLoader($choices);

        $result = $loader->loadChoicesForValues(['']);

        self::assertSame([], $result);
    }

    public function testEmojiValuesAreCheckedAgainstTheCatalogueAndNeverRendered(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->expects(self::never())->method('renderIcon');
        $loader = new IconChoiceLoader(['bi:house' => 'house'], $renderer, new EmojiCatalog());

        $result = $loader->loadChoicesForValues(['emoji:🚀', 'emoji:rocket', 'emoji:🚀🚀', "emoji:\u{202E}🚀", 'emoji:'], static fn ($v) => $v);

        self::assertSame(['emoji:🚀'], array_values($result));
    }

    public function testWithoutCatalogueEmojiValuesKeepThePreviousBehaviour(): void
    {
        $loader = new IconChoiceLoader([]);

        self::assertSame(['emoji:x'], array_values($loader->loadChoicesForValues(['emoji:x'], static fn ($v) => $v)));
    }
}
