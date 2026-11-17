<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Form;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Nowo\IconSelectorBundle\Emoji\EmojiCatalog;
use Nowo\IconSelectorBundle\Form\IconSelectorType;
use Nowo\IconSelectorBundle\Service\IconListProvider;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use Symfony\Bridge\Twig\Extension\FormExtension;
use Symfony\Bridge\Twig\Extension\TranslationExtension;
use Symfony\Bridge\Twig\Form\TwigRendererEngine;
use Symfony\Component\Form\Extension\Core\Type\FormType;
use Symfony\Component\Form\FormRenderer;
use Symfony\Component\Form\Forms;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;
use Twig\RuntimeLoader\FactoryRuntimeLoader;

use function dirname;
use function libxml_use_internal_errors;

/**
 * Renders the shipped form themes and checks the generated markup (unique ids, single controller/class, a11y).
 */
#[CoversNothing]
final class IconSelectorThemeRenderingTest extends TestCase
{
    /**
     * @return iterable<string, array{string}>
     */
    public static function themeProvider(): iterable
    {
        foreach ([
            'icon_selector_theme.html.twig',
            'icon_selector_theme_bootstrap3.html.twig',
            'icon_selector_theme_bootstrap3_horizontal.html.twig',
            'icon_selector_theme_bootstrap4.html.twig',
            'icon_selector_theme_bootstrap4_horizontal.html.twig',
            'icon_selector_theme_bootstrap5.html.twig',
            'icon_selector_theme_bootstrap5_horizontal.html.twig',
            'icon_selector_theme_foundation5.html.twig',
            'icon_selector_theme_foundation6.html.twig',
            'icon_selector_theme_table.html.twig',
            'icon_selector_theme_tailwind2.html.twig',
        ] as $theme) {
            yield $theme => [$theme];
        }
    }

    #[DataProvider('themeProvider')]
    public function testDirectWidgetHasUniqueIdsAndSingleControllerAndClass(string $theme): void
    {
        $xpath = $this->render($theme, ['mode' => 'direct', 'attr' => ['data-controller' => 'icon-selector other', 'class' => 'extra']]);

        self::assertSame(1, $this->countNodes($xpath, '//*[@id="form_icon_direct"]'), 'The field id must be used by exactly one element.');
        $input = $this->single($xpath, '//input[@name="form[icon_direct]"]');
        self::assertSame('form_icon_direct', $input->getAttribute('id'));
        self::assertFalse($input->hasAttribute('data-controller'), 'The inner input must not carry the Stimulus controller.');

        $wrappers = $xpath->query('//*[@data-controller]');
        self::assertNotFalse($wrappers);
        self::assertCount(1, $wrappers, 'Only the wrapper declares the controller.');
        $wrapper = $wrappers->item(0);
        self::assertInstanceOf(DOMElement::class, $wrapper);
        self::assertSame('form_icon_direct_icon_selector', $wrapper->getAttribute('id'));
        self::assertSame('icon-selector other', $wrapper->getAttribute('data-controller'));
        self::assertSame('extra icon-selector-widget', $wrapper->getAttribute('class'));

        $picker = $this->single($xpath, '//*[@data-icon-selector-target="picker"]');
        self::assertFalse($picker->hasAttribute('aria-hidden'), 'The picker hosts the trigger and panel: it must not be aria-hidden.');
    }

    public function testDefaultThemeTomSelectHasUniqueIdsAndEmptyText(): void
    {
        $xpath = $this->render('icon_selector_theme.html.twig', ['mode' => 'tom_select']);

        self::assertSame(1, $this->countNodes($xpath, '//*[@id="form_icon_direct"]'));
        $select = $this->single($xpath, '//select[@name="form[icon_direct]"]');
        self::assertSame('form_icon_direct', $select->getAttribute('id'));
        self::assertFalse($select->hasAttribute('data-controller'));
        self::assertSame('icon-selector', $this->single($xpath, '//div[@id="form_icon_direct_icon_selector"]')->getAttribute('data-controller'));
        self::assertSame('no_icons', $this->single($xpath, '//*[@data-icon-selector-empty-text]')->getAttribute('data-icon-selector-empty-text'));
    }

    public function testTomSelectKeepsAStoredEmojiAsTheSelectedOption(): void
    {
        $xpath  = $this->render('icon_selector_theme.html.twig', ['mode' => 'tom_select', 'emoji' => true], 'emoji:🚀');
        $option = $this->single($xpath, '//select[@name="form[icon_direct]"]/option[@selected]');

        self::assertSame('emoji:🚀', $option->getAttribute('value'));
        self::assertSame('🚀', $option->textContent);
    }

    public function testTomSelectWithoutEmojiModeAddsNoEmojiOption(): void
    {
        $xpath = $this->render('icon_selector_theme.html.twig', ['mode' => 'tom_select'], 'heroicons-outline:home');

        self::assertSame(0, $this->countNodes($xpath, '//option[starts-with(@value, "emoji:")]'));
    }

    public function testEmojiDirectModeRendersTheTextFallbackInput(): void
    {
        $xpath = $this->render('icon_selector_theme.html.twig', ['mode' => 'direct', 'emoji' => true], 'emoji:🚀');
        $input = $this->single($xpath, '//input[@name="form[icon_direct]"]');

        self::assertSame('text', $input->getAttribute('type'));
        self::assertSame('1', $input->getAttribute('data-icon-selector-emoji-fallback'));
        self::assertSame('emoji:🚀', $input->getAttribute('value'));
    }

    /**
     * Strict CSP (nonce-only style-src): no theme emits an inline <style> element or a style attribute; the styles
     * come from the linked bundle stylesheet.
     */
    #[DataProvider('themeProvider')]
    public function testThemesEmitNoInlineStylesAndLinkTheStylesheet(string $theme): void
    {
        foreach (['direct', 'search', 'tom_select'] as $mode) {
            foreach ([false, true] as $emoji) {
                $html = $this->renderHtml($theme, ['mode' => $mode, 'emoji' => $emoji], 'heroicons-outline:home');
                self::assertDoesNotMatchRegularExpression('/<style\b/i', $html, $theme . ' ' . $mode);
                self::assertDoesNotMatchRegularExpression('/\sstyle\s*=/i', $html, $theme . ' ' . $mode);
                self::assertStringContainsString('<link rel="stylesheet" href="/bundles/nowoiconselector/icon-selector.css" data-nowo-icon-selector-stylesheet>', $html);
            }
        }
    }

    #[DataProvider('themeProvider')]
    public function testThemesOmitTheStylesheetLinkWhenDisabled(string $theme): void
    {
        $html = $this->renderHtml($theme, ['mode' => 'direct'], null, false);

        self::assertStringNotContainsString('<link', $html);
    }

    public function testEmojiSkeletonIsHiddenWithoutScripting(): void
    {
        $xpath = $this->render('icon_selector_theme.html.twig', ['mode' => 'direct', 'emoji' => true]);

        self::assertSame(1, $this->countNodes($xpath, '//div[contains(@class, "icon-selector-skeleton--noscript-hidden")]'));
        self::assertSame(0, $this->countNodes($xpath, '//noscript'));
    }

    /**
     * @param array<string, mixed> $options IconSelectorType options
     */
    private function render(string $theme, array $options, ?string $data = null): DOMXPath
    {
        $html = $this->renderHtml($theme, $options, $data);

        $dom      = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $dom->loadHTML('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' . $html . '</body></html>');
        libxml_use_internal_errors($previous);

        return new DOMXPath($dom);
    }

    /**
     * @param array<string, mixed> $options IconSelectorType options
     */
    private function renderHtml(string $theme, array $options, ?string $data = null, bool $includeStylesheet = true): string
    {
        $vendorDir = dirname((new ReflectionClass(FormExtension::class))->getFileName() ?: '', 2);
        $loader    = new FilesystemLoader([$vendorDir . '/Resources/views/Form', dirname(__DIR__, 3) . '/src/Resources/views/Form']);
        $twig      = new Environment($loader, ['strict_variables' => true]);
        $twig->addExtension(new FormExtension());
        $twig->addExtension(new TranslationExtension());
        $renderer = new FormRenderer(new TwigRendererEngine([$theme], $twig));
        $twig->addRuntimeLoader(new FactoryRuntimeLoader([FormRenderer::class => static fn (): FormRenderer => $renderer]));

        $type    = new IconSelectorType(new IconListProvider(['heroicons']), ['heroicons'], '/api/icon-selector/icons', null, null, false, new EmojiCatalog(), includeStylesheet: $includeStylesheet);
        $factory = Forms::createFormFactoryBuilder()->addType($type)->getFormFactory();
        $form    = $factory->createNamedBuilder('form', FormType::class)
            ->add('icon_direct', IconSelectorType::class, $options + ['data' => $data])
            ->getForm();

        return $twig->createTemplate('{{ form_widget(form.icon_direct) }}')->render(['form' => $form->createView()]);
    }

    private function single(DOMXPath $xpath, string $query): DOMElement
    {
        $nodes = $xpath->query($query);
        self::assertNotFalse($nodes);
        self::assertCount(1, $nodes, $query);
        $node = $nodes->item(0);
        self::assertInstanceOf(DOMElement::class, $node);

        return $node;
    }

    private function countNodes(DOMXPath $xpath, string $query): int
    {
        $nodes = $xpath->query($query);
        self::assertNotFalse($nodes);

        return $nodes->length;
    }
}
