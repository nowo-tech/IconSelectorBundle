<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Twig;

use Nowo\IconSelectorBundle\Emoji\EmojiCatalog;
use Nowo\IconSelectorBundle\Service\SvgSanitizer;
use Nowo\IconSelectorBundle\Twig\IconRenderTwigExtension;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\UX\Icons\IconRendererInterface;
use Twig\Environment;
use Twig\Loader\ArrayLoader;

#[CoversClass(IconRenderTwigExtension::class)]
final class IconRenderTwigExtensionTest extends TestCase
{
    private function extension(?IconRendererInterface $renderer = null): IconRenderTwigExtension
    {
        return new IconRenderTwigExtension(new EmojiCatalog(), new SvgSanitizer(), $renderer);
    }

    private function twig(string $template, ?IconRendererInterface $renderer = null): Environment
    {
        $twig = new Environment(new ArrayLoader(['t' => $template]), ['autoescape' => 'html']);
        $twig->addExtension($this->extension($renderer));

        return $twig;
    }

    public function testRendersEmojiAsEscapedTextWithAccessibleName(): void
    {
        self::assertSame(
            '<span class="nowo-icon-emoji" role="img" aria-label="rocket">🚀</span>',
            $this->extension()->render('emoji:🚀'),
        );
    }

    public function testEmojiAttributesAreEscapedAndHandlersDropped(): void
    {
        $html = $this->extension()->render('emoji:🚀', [
            'class'      => 'me-1" onmouseover="alert(1)',
            'onclick'    => 'alert(1)',
            'OnFocus'    => 'alert(1)',
            'style'      => 'background:url(x)',
            'role'       => 'button',
            'title'      => '<b>',
            'aria-label' => 'Launch',
            'bad name'   => 'x',
            'hidden'     => true,
            'data-x'     => null,
            'data-list'  => ['x'],
        ]);

        self::assertSame(
            '<span class="nowo-icon-emoji me-1&quot; onmouseover=&quot;alert(1)" role="img" aria-label="Launch" title="&lt;b&gt;" hidden="hidden">🚀</span>',
            $html,
        );
    }

    public function testInvalidEmojiRendersNothing(): void
    {
        $ext = $this->extension();

        self::assertSame('', $ext->render('emoji:<script>alert(1)</script>'));
        self::assertSame('', $ext->render('emoji:🚀🚀'));
        self::assertSame('', $ext->render("emoji:\u{202E}🚀"));
        self::assertSame('', $ext->render(null));
        self::assertSame('', $ext->render('  '));
    }

    public function testIconsGoThroughTheRendererAndTheSanitizer(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->expects(self::once())->method('renderIcon')->with('tabler:home', ['class' => 'x'])
            ->willReturn('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><path d="M0 0"/></svg>');

        $html = $this->extension($renderer)->render('tabler:home', ['class' => 'x']);

        self::assertStringContainsString('<path', $html);
        self::assertStringNotContainsString('onload', $html);
        self::assertStringNotContainsString('script', $html);
    }

    public function testIconFailuresAndMissingRendererRenderNothing(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->method('renderIcon')->willThrowException(new RuntimeException('not found'));

        self::assertSame('', $this->extension($renderer)->render('tabler:nope'));
        self::assertSame('', $this->extension()->render('tabler:home'));
    }

    public function testEmojiValuesNeverReachTheIconRenderer(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->expects(self::never())->method('renderIcon');

        self::assertSame('', $this->extension($renderer)->render('emoji:nope'));
    }

    public function testTwigFunctionFilterAndTests(): void
    {
        $twig = $this->twig("{{ nowo_icon_selector_render(v) }}|{{ v|nowo_icon_selector_render({class: 'a'}) }}|{{ nowo_icon_selector_is_emoji(v) ? 'y' : 'n' }}|{{ nowo_icon_selector_emoji_name(v) }}|{{ nowo_icon_selector_is_emoji(w) ? 'y' : 'n' }}");

        self::assertSame(
            '<span class="nowo-icon-emoji" role="img" aria-label="red heart">❤️</span>|<span class="nowo-icon-emoji a" role="img" aria-label="red heart">❤️</span>|y|red heart|n',
            $twig->render('t', ['v' => "emoji:\u{2764}\u{FE0F}", 'w' => 'emoji:x']),
        );
    }

    public function testEmojiNameIsEscapedByTwigWhenPrinted(): void
    {
        $twig = $this->twig('{{ nowo_icon_selector_emoji_name(v) }}');

        self::assertSame('', $twig->render('t', ['v' => 'emoji:<b>']));
    }
}
