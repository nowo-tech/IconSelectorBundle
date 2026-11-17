<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Form;

use Nowo\IconSelectorBundle\Emoji\EmojiCatalog;
use Nowo\IconSelectorBundle\Form\IconSelectorType;
use Nowo\IconSelectorBundle\Service\IconListProvider;
use Nowo\IconSelectorBundle\Service\LocalUxIconsScanner;
use Nowo\IconSelectorBundle\Service\SvgSanitizer;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;
use stdClass;
use Symfony\Component\Asset\Packages;
use Symfony\Component\Asset\PathPackage;
use Symfony\Component\Asset\VersionStrategy\EmptyVersionStrategy;
use Symfony\Component\Form\ChoiceList\ChoiceListInterface;
use Symfony\Component\Form\ChoiceList\Factory\CachingFactoryDecorator;
use Symfony\Component\Form\ChoiceList\Factory\DefaultChoiceListFactory;
use Symfony\Component\Form\ChoiceList\View\ChoiceView;
use Symfony\Component\Form\Extension\Core\CoreExtension;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\FormFactoryBuilder;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormView;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\OptionsResolver\Exception\InvalidOptionsException;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Contracts\Translation\TranslatorInterface;
use Symfony\UX\Icons\IconRendererInterface;

use function count;
use function dirname;

/**
 * Unit tests for IconSelectorType (options, buildView, choices from icons).
 *
 * @covers \Nowo\IconSelectorBundle\Form\IconSelectorType
 */
final class IconSelectorTypeTest extends TestCase
{
    /**
     * Builds an IconSelectorType instance for testing with optional icon sets and API path.
     *
     * @param list<string> $iconSets Enabled icon set names
     */
    private function createType(
        IconListProvider $provider,
        array $iconSets = [],
        string $iconsApiPath = '',
        ?IconRendererInterface $iconRenderer = null,
    ): IconSelectorType {
        return new IconSelectorType($provider, $iconSets, $iconsApiPath, $iconRenderer, new SvgSanitizer());
    }

    /**
     * Returns an empty list of icon set names (for tests that need no default sets).
     *
     * @return list<string>
     */
    private function emptyIconSets(): array
    {
        return [];
    }

    /** Creates a provider with no icon sets configured (empty icon list). */
    private function createEmptyProvider(): IconListProvider
    {
        return new IconListProvider([]);
    }

    public function testDefaultOptions(): void
    {
        $type     = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '/api/icons');
        $resolver = new OptionsResolver();
        $type->configureOptions($resolver);
        $options = $resolver->resolve([]);
        self::assertSame('direct', $options['mode']);
        self::assertNull($options['icon_sets']);
        self::assertNull($options['icons']);
        self::assertSame([], $options['choices']);
        self::assertSame('NowoIconSelectorBundle', $options['translation_domain']);
        self::assertSame('NowoIconSelectorBundle', $options['choice_translation_domain']);
        self::assertSame('placeholder', $options['placeholder']);
        self::assertSame('search_placeholder', $options['search_placeholder']);
    }

    public function testModeSearch(): void
    {
        $type     = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '/api/icons');
        $resolver = new OptionsResolver();
        $type->configureOptions($resolver);
        $options = $resolver->resolve(['mode' => 'search']);
        self::assertSame('search', $options['mode']);
    }

    public function testModeTomSelect(): void
    {
        $type     = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '/api/icons');
        $resolver = new OptionsResolver();
        $type->configureOptions($resolver);
        $options = $resolver->resolve(['mode' => 'tom_select']);
        self::assertSame('tom_select', $options['mode']);
    }

    public function testChoicesBuiltFromIcons(): void
    {
        $type     = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '/api/icons');
        $resolver = new OptionsResolver();
        $type->configureOptions($resolver);
        $options = $resolver->resolve(['icons' => ['heroicons-outline:home', 'bi:house']]);
        self::assertSame(['heroicons-outline:home' => 'home', 'bi:house' => 'house'], $options['choices']);
    }

    public function testChoicesBuiltFromIconSetsOption(): void
    {
        $provider = new IconListProvider(['heroicons']);
        $type     = $this->createType($provider, ['heroicons', 'bootstrap-icons'], '/api/icons');
        $resolver = new OptionsResolver();
        $type->configureOptions($resolver);
        $options = $resolver->resolve(['icon_sets' => ['heroicons']]);
        self::assertArrayHasKey('heroicons-outline:home', $options['choices']);
        self::assertSame('home', $options['choices']['heroicons-outline:home']);
        self::assertArrayHasKey('heroicons-outline:user', $options['choices']);
        self::assertSame('user', $options['choices']['heroicons-outline:user']);
    }

    public function testBlockPrefixAndParentIsChoiceType(): void
    {
        $type = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '');
        self::assertSame('icon_selector', $type->getBlockPrefix());
        self::assertSame(ChoiceType::class, $type->getParent());
    }

    public function testBuildViewUsesDefaultsFromConstructor(): void
    {
        $provider           = new IconListProvider(['heroicons', 'bootstrap-icons']);
        $type               = $this->createType($provider, ['heroicons', 'bi'], '/api/icon-selector/icons');
        $view               = new FormView();
        $view->vars['attr'] = [];
        $form               = $this->createStub(FormInterface::class);

        $baseOptions = [
            'mode'                      => 'direct',
            'icon_sets'                 => null,
            'icons_api_path'            => null,
            'icons'                     => null,
            'choices'                   => [],
            'placeholder'               => 'placeholder',
            'required'                  => true,
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'search_placeholder'        => 'search_placeholder',
        ];
        $type->buildView($view, $form, $baseOptions);

        self::assertSame('direct', $view->vars['mode']);
        self::assertSame(['heroicons', 'bi'], $view->vars['icon_sets']);
        self::assertSame('/api/icon-selector/icons', $view->vars['icons_api_path']);
        self::assertNotEmpty($view->vars['icons']);
        self::assertStringContainsString('icon-selector', $view->vars['attr']['data-controller']);
        self::assertSame('direct', $view->vars['attr']['data-icon-selector-mode-value']);
        self::assertSame('/api/icon-selector/icons', $view->vars['attr']['data-icon-selector-icons-url-value']);
        self::assertSame('NowoIconSelectorBundle', $view->vars['translation_domain']);
        self::assertSame('NowoIconSelectorBundle', $view->vars['choice_translation_domain']);
        self::assertSame('search_placeholder', $view->vars['search_placeholder']);
    }

    public function testBuildViewUsesOptionsOverridingConstructor(): void
    {
        $type               = $this->createType($this->createEmptyProvider(), ['heroicons'], '/api/default');
        $view               = new FormView();
        $view->vars['attr'] = [];
        $form               = $this->createStub(FormInterface::class);

        $type->buildView($view, $form, [
            'mode'                      => 'search',
            'icon_sets'                 => ['bi'],
            'icons_api_path'            => '/custom/icons',
            'icons'                     => ['bi:house'],
            'choices'                   => ['house' => 'bi:house'],
            'placeholder'               => 'placeholder',
            'required'                  => true,
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'search_placeholder'        => 'search_placeholder',
        ]);

        self::assertSame('search', $view->vars['mode']);
        self::assertSame(['bi:house'], $view->vars['icons']);
        self::assertSame(['bi'], $view->vars['icon_sets']);
        self::assertSame('/custom/icons', $view->vars['icons_api_path']);
        self::assertSame('search', $view->vars['attr']['data-icon-selector-mode-value']);
        self::assertSame('/custom/icons', $view->vars['attr']['data-icon-selector-icons-url-value']);
    }

    public function testBuildViewResolvesIconsFromProviderWhenIconSetsOptionGiven(): void
    {
        $provider           = new IconListProvider(['heroicons']);
        $type               = $this->createType($provider, ['heroicons', 'bootstrap-icons'], '/api/icons');
        $view               = new FormView();
        $view->vars['attr'] = [];
        $form               = $this->createStub(FormInterface::class);

        $type->buildView($view, $form, [
            'mode'                      => 'tom_select',
            'icon_sets'                 => ['heroicons'],
            'icons_api_path'            => null,
            'icons'                     => null,
            'choices'                   => [],
            'placeholder'               => null,
            'required'                  => true,
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'search_placeholder'        => 'search_placeholder',
        ]);

        self::assertSame(['heroicons'], $view->vars['icon_sets']);
        self::assertContains('heroicons-outline:home', $view->vars['icons']);
        self::assertGreaterThanOrEqual(1, count($view->vars['choices']));
        $homeChoice = null;
        foreach ($view->vars['choices'] as $c) {
            if ($c->label === 'home') {
                $homeChoice = $c;
                break;
            }
        }
        self::assertNotNull($homeChoice);
        self::assertSame('home', $homeChoice->label);
        self::assertStringStartsWith('heroicons-', $homeChoice->value);
    }

    public function testBuildViewAppendsToExistingDataController(): void
    {
        $type               = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '');
        $view               = new FormView();
        $view->vars['attr'] = ['data-controller' => 'other-controller'];
        $form               = $this->createStub(FormInterface::class);

        $type->buildView($view, $form, [
            'mode'                      => 'direct',
            'icon_sets'                 => null,
            'icons_api_path'            => null,
            'icons'                     => null,
            'choices'                   => [],
            'placeholder'               => '',
            'required'                  => true,
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'search_placeholder'        => 'search_placeholder',
        ]);
        self::assertSame('other-controller icon-selector', $view->vars['attr']['data-controller']);
    }

    public function testBuildViewDoesNotDuplicateIconSelectorController(): void
    {
        $type               = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '');
        $view               = new FormView();
        $view->vars['attr'] = ['data-controller' => ' icon-selector  other icon-selector '];
        $form               = $this->createStub(FormInterface::class);

        $type->buildView($view, $form, [
            'mode'                      => 'direct',
            'icon_sets'                 => null,
            'icons_api_path'            => null,
            'icons'                     => null,
            'choices'                   => [],
            'placeholder'               => '',
            'required'                  => true,
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'search_placeholder'        => 'search_placeholder',
        ]);
        self::assertSame('icon-selector other', $view->vars['attr']['data-controller']);
    }

    public function testBuildViewSetsChoicesAndPlaceholder(): void
    {
        $type               = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '');
        $view               = new FormView();
        $view->vars['attr'] = [];
        $form               = $this->createStub(FormInterface::class);

        $type->buildView($view, $form, [
            'mode'                      => 'tom_select',
            'choices'                   => ['home' => 'heroicons-outline:home', 'house' => 'bi:house'],
            'placeholder'               => 'Elegir...',
            'required'                  => true,
            'icon_sets'                 => null,
            'icons_api_path'            => null,
            'icons'                     => null,
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'search_placeholder'        => 'search_placeholder',
        ]);

        self::assertCount(2, $view->vars['choices']);
        self::assertSame('Elegir...', $view->vars['placeholder']);
        self::assertTrue($view->vars['placeholder_in_choices']);
    }

    public function testBuildViewTomSelectPreloadsSelectedOptionWithSvg(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->expects(self::once())
            ->method('renderIcon')
            ->with('heroicons-outline:home')
            ->willReturn('<svg><path d="ok"/></svg>');

        $type                = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '', $renderer);
        $view                = new FormView();
        $view->vars['attr']  = [];
        $view->vars['value'] = 'heroicons-outline:home';
        $form                = $this->createStub(FormInterface::class);

        $type->buildView($view, $form, [
            'mode'                      => 'tom_select',
            'choices'                   => ['heroicons-outline:home' => 'home'],
            'placeholder'               => null,
            'required'                  => true,
            'icon_sets'                 => null,
            'icons_api_path'            => null,
            'icons'                     => null,
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'search_placeholder'        => 'search_placeholder',
        ]);

        self::assertArrayHasKey('tom_select_preloaded_options', $view->vars);
        self::assertCount(1, $view->vars['tom_select_preloaded_options']);
        self::assertSame('heroicons-outline:home', $view->vars['tom_select_preloaded_options'][0]['value']);
        self::assertSame('home', $view->vars['tom_select_preloaded_options'][0]['text']);
        self::assertStringContainsString('<svg>', $view->vars['tom_select_preloaded_options'][0]['svg']);
    }

    public function testBuildViewTomSelectNeverRendersSubmittedValueOutsideChoices(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->expects(self::never())->method('renderIcon');

        $type                = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '', $renderer);
        $view                = new FormView();
        $view->vars['attr']  = [];
        $view->vars['value'] = 'attacker-set:arbitrary-icon';
        $form                = $this->createStub(FormInterface::class);

        $type->buildView($view, $form, [
            'mode'                      => 'tom_select',
            'choices'                   => ['heroicons-outline:home' => 'home'],
            'placeholder'               => null,
            'required'                  => true,
            'icon_sets'                 => null,
            'icons_api_path'            => null,
            'icons'                     => null,
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'search_placeholder'        => 'search_placeholder',
        ]);

        self::assertSame([], $view->vars['tom_select_preloaded_options']);
    }

    public function testBuildViewFillsChoicesFromIconsWhenChoicesEmpty(): void
    {
        $type               = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '');
        $view               = new FormView();
        $view->vars['attr'] = [];
        $form               = $this->createStub(FormInterface::class);

        $type->buildView($view, $form, [
            'mode'                      => 'tom_select',
            'choices'                   => [],
            'placeholder'               => null,
            'required'                  => true,
            'icon_sets'                 => null,
            'icons_api_path'            => null,
            'icons'                     => ['heroicons-outline:home', 'bi:house'],
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'search_placeholder'        => 'search_placeholder',
        ]);

        self::assertCount(2, $view->vars['choices']);
        self::assertSame('home', $view->vars['choices'][0]->label);
        self::assertSame('heroicons-outline:home', $view->vars['choices'][0]->value);
        self::assertSame('house', $view->vars['choices'][1]->label);
        self::assertSame('bi:house', $view->vars['choices'][1]->value);
    }

    /** buildView with choices in id=>label format (key contains ':') uses them without flipping. */
    public function testBuildViewWithChoicesIdToLabelFormat(): void
    {
        $type               = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '');
        $view               = new FormView();
        $view->vars['attr'] = [];
        $form               = $this->createStub(FormInterface::class);

        $type->buildView($view, $form, [
            'mode'                      => 'tom_select',
            'choices'                   => ['heroicons-outline:home' => 'home', 'bi:house' => 'house'],
            'placeholder'               => null,
            'required'                  => true,
            'icon_sets'                 => null,
            'icons_api_path'            => null,
            'icons'                     => null,
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'search_placeholder'        => 'search_placeholder',
        ]);

        self::assertCount(2, $view->vars['choices']);
        self::assertSame('home', $view->vars['choices'][0]->label);
        self::assertSame('heroicons-outline:home', $view->vars['choices'][0]->value);
        self::assertSame('house', $view->vars['choices'][1]->label);
        self::assertSame('bi:house', $view->vars['choices'][1]->value);
    }

    public function testBuildViewTomSelectPreloadsFirstChoicesWhenNoSelection(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->method('renderIcon')->willReturn('<svg></svg>');

        $choices = [];
        for ($i = 1; $i <= 15; ++$i) {
            $choices['heroicons-outline:icon' . $i] = 'icon' . $i;
        }

        $type                = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '', $renderer);
        $view                = new FormView();
        $view->vars['attr']  = [];
        $view->vars['value'] = '';
        $form                = $this->createStub(FormInterface::class);

        $type->buildView($view, $form, [
            'mode'                      => 'tom_select',
            'choices'                   => $choices,
            'placeholder'               => null,
            'required'                  => true,
            'icon_sets'                 => null,
            'icons_api_path'            => null,
            'icons'                     => null,
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'search_placeholder'        => 'search_placeholder',
        ]);

        self::assertCount(12, $view->vars['tom_select_preloaded_options']);
    }

    public function testBuildViewTomSelectIgnoresRendererFailures(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->method('renderIcon')->willThrowException(new RuntimeException('render failed'));

        $type                = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '', $renderer);
        $view                = new FormView();
        $view->vars['attr']  = [];
        $view->vars['value'] = 'heroicons-outline:home';
        $form                = $this->createStub(FormInterface::class);

        $type->buildView($view, $form, [
            'mode'                      => 'tom_select',
            'choices'                   => ['heroicons-outline:home' => 'home'],
            'placeholder'               => null,
            'required'                  => true,
            'icon_sets'                 => null,
            'icons_api_path'            => null,
            'icons'                     => null,
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'search_placeholder'        => 'search_placeholder',
        ]);

        self::assertSame('', $view->vars['tom_select_preloaded_options'][0]['svg']);
    }

    public function testBuildViewTomSelectSkipsEmptyChoiceIds(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->method('renderIcon')->willReturn('<svg></svg>');

        $type    = $this->createType($this->createEmptyProvider(), $this->emptyIconSets(), '', $renderer);
        $method  = new ReflectionMethod(IconSelectorType::class, 'buildTomSelectPreloadedOptions');
        $choices = ['' => 'empty', 'heroicons-outline:home' => 'home'];

        $result = $method->invoke($type, $choices, '');

        self::assertCount(1, $result);
        self::assertSame('heroicons-outline:home', $result[0]['value']);
    }

    /**
     * Two consecutive "requests" render the field with the same shared factory and no reset():
     * Symfony's cached choice list factory must reuse one list and one view instead of growing.
     */
    public function testRepeatedRendersReuseCachedChoiceListWithoutReset(): void
    {
        $decorator   = new CachingFactoryDecorator(new DefaultChoiceListFactory());
        $formFactory = $this->createFormFactory(new IconListProvider(['heroicons', 'bootstrap-icons']), $decorator);

        foreach ([1, 2, 3] as $request) {
            $form = $formFactory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons']]);
            $view = $form->createView();
            self::assertContains('heroicons-outline:home', $this->listChoices($form), 'request ' . $request);
            self::assertContains('heroicons-outline:home', array_map(static fn (ChoiceView $c): string => $c->value, $view->vars['choices']), 'request ' . $request);
        }

        self::assertCount(1, $this->cachedEntries($decorator, 'lists'));
        self::assertCount(1, $this->cachedEntries($decorator, 'views'));
    }

    public function testDifferentIconSetsGetTheirOwnCachedChoiceList(): void
    {
        $decorator   = new CachingFactoryDecorator(new DefaultChoiceListFactory());
        $formFactory = $this->createFormFactory(new IconListProvider(['heroicons', 'bootstrap-icons']), $decorator);

        $heroForm = $formFactory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons']]);
        $biForm   = $formFactory->create(IconSelectorType::class, null, ['icon_sets' => ['bootstrap-icons']]);
        $heroForm->createView();
        $biForm->createView();

        $heroValues = $this->listChoices($heroForm);
        $biValues   = $this->listChoices($biForm);

        self::assertContains('heroicons-outline:home', $heroValues);
        self::assertNotContains('bi:house', $heroValues);
        self::assertContains('bi:house', $biValues);
        self::assertNotContains('heroicons-outline:home', $biValues);
        self::assertCount(2, $this->cachedEntries($decorator, 'lists'));
    }

    public function testCachedLoaderStillAcceptsSubmittedIconOutsideTheBaseList(): void
    {
        $formFactory = $this->createFormFactory(new IconListProvider(['heroicons']), new CachingFactoryDecorator(new DefaultChoiceListFactory()));

        $first = $formFactory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons']]);
        $first->submit('heroicons-outline:home');
        self::assertTrue($first->isSynchronized());
        self::assertSame('heroicons-outline:home', $first->getData());

        $second = $formFactory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons']]);
        $second->submit('lucide:rocket');
        self::assertTrue($second->isSynchronized());
        self::assertSame('lucide:rocket', $second->getData());
    }

    public function testEmojiOptionDefaultsOff(): void
    {
        $type     = $this->createType($this->createEmptyProvider());
        $resolver = new OptionsResolver();
        $type->configureOptions($resolver);
        $options = $resolver->resolve([]);

        self::assertFalse($options['emoji']);
        self::assertNull($options['emoji_data_url']);

        $form = $this->createEmojiFormFactory()->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons']]);
        $view = $form->createView();
        self::assertFalse($view->vars['emoji']);
        self::assertArrayNotHasKey('data-icon-selector-emoji-value', $view->vars['attr']);
    }

    public function testEmojiOptionExposesDatasetUrlLabelsAndCurrentEmoji(): void
    {
        $translator = new class implements TranslatorInterface {
            /**
             * @param array<string, mixed> $parameters
             */
            public function trans(string $id, array $parameters = [], ?string $domain = null, ?string $locale = null): string
            {
                return match ($id) {
                    'emoji.tab_emoji' => 'Emoji <b>',
                    'emoji.tone_1'    => 'Clara',
                    default           => $id,
                };
            }

            public function getLocale(): string
            {
                return 'es';
            }
        };
        $factory = $this->createEmojiFormFactory($translator);
        $form    = $factory->create(IconSelectorType::class, 'emoji:🚀', ['icon_sets' => ['heroicons'], 'emoji' => true]);
        $view    = $form->createView();

        self::assertTrue($view->vars['emoji']);
        self::assertSame('🚀', $view->vars['emoji_value']);
        self::assertSame('rocket', $view->vars['emoji_name']);
        self::assertSame('1', $view->vars['attr']['data-icon-selector-emoji-value']);
        self::assertSame('/emoji.json', $view->vars['attr']['data-icon-selector-emoji-url-value']);
        $labels = json_decode($view->vars['attr']['data-icon-selector-emoji-labels'], true);
        self::assertIsArray($labels);
        self::assertSame('Emoji <b>', $labels['tab_emoji']);
        self::assertSame('', $labels['search']);
        self::assertSame(['Clara', '', '', '', ''], $labels['tones']);

        $custom = $factory->create(IconSelectorType::class, 'emoji:nope', ['icon_sets' => ['heroicons'], 'emoji' => true, 'emoji_data_url' => '/x.json'])->createView();
        self::assertSame('/x.json', $custom->vars['attr']['data-icon-selector-emoji-url-value']);
        self::assertNull($custom->vars['emoji_value']);
    }

    /**
     * 1.8 (Beacon / WikiBundle): the picker's own texts always come from the bundle domain, whatever the field's
     * translation_domain; a placeholder passed by the host is translated in the field's domain.
     */
    public function testOwnTextsUseTheBundleDomainAndHostTextsTheFieldDomain(): void
    {
        $translator = new class implements TranslatorInterface {
            /** @var list<string> */
            public array $calls = [];

            /**
             * @param array<string, mixed> $parameters
             */
            public function trans(string $id, array $parameters = [], ?string $domain = null, ?string $locale = null): string
            {
                $this->calls[] = ($domain ?? 'messages') . ':' . $id;
                $catalogue     = [
                    'NowoIconSelectorBundle' => [
                        'placeholder'        => 'Elegir icono...',
                        'search_placeholder' => 'Buscar iconos...',
                        'no_icons'           => 'No hay iconos disponibles.',
                        'filter.all'         => 'Todos',
                        'filter.category'    => 'Categoría:',
                        'filter.sets'        => 'Conjuntos de iconos',
                        'filter.categories'  => 'Categorías',
                        'emoji.tab_emoji'    => 'Emoji',
                    ],
                    'HostDomain' => ['host.pick' => 'Elige un icono de página'],
                ];

                return $catalogue[$domain ?? 'messages'][$id] ?? $id;
            }

            public function getLocale(): string
            {
                return 'es';
            }
        };
        $factory = $this->createEmojiFormFactory($translator);

        $view = $factory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons'], 'mode' => 'search', 'emoji' => true, 'translation_domain' => 'HostDomain'])->createView();
        self::assertSame('Elegir icono...', $view->vars['placeholder_text']);
        self::assertSame('Buscar iconos...', $view->vars['search_placeholder_text']);
        self::assertSame('Buscar iconos...', $view->vars['attr']['data-icon-selector-search-placeholder']);
        self::assertSame('No hay iconos disponibles.', $view->vars['attr']['data-icon-selector-empty-text']);
        $labels = json_decode($view->vars['attr']['data-icon-selector-labels'], true);
        self::assertSame([
            'placeholder'        => 'Elegir icono...',
            'search_placeholder' => 'Buscar iconos...',
            'empty'              => 'No hay iconos disponibles.',
            'all'                => 'Todos',
            'category'           => 'Categoría:',
            'sets'               => 'Conjuntos de iconos',
            'categories'         => 'Categorías',
        ], $labels);
        $emoji = json_decode($view->vars['attr']['data-icon-selector-emoji-labels'], true);
        self::assertIsArray($emoji);
        self::assertSame('Emoji', $emoji['tab_emoji']);
        foreach ($translator->calls as $call) {
            self::assertStringStartsNotWith('HostDomain:emoji.', $call, 'Emoji labels are looked up in the bundle domain only.');
            self::assertNotSame('HostDomain:search_placeholder', $call);
        }

        $host = $factory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons'], 'translation_domain' => 'HostDomain', 'search_placeholder' => 'host.pick', 'placeholder' => 'host.pick'])->createView();
        self::assertSame('Elige un icono de página', $host->vars['search_placeholder_text']);
        self::assertSame('Elige un icono de página', $host->vars['placeholder_text']);

        $raw = $factory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons'], 'translation_domain' => false, 'search_placeholder' => 'Literal text'])->createView();
        self::assertSame('Literal text', $raw->vars['search_placeholder_text']);
    }

    public function testThemeOptionOverridesTheConfiguredTheme(): void
    {
        $factory = $this->createEmojiFormFactory();
        self::assertSame('bootstrap', $factory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons']])->createView()->vars['icon_selector_theme']);
        $uikit = $factory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons'], 'theme' => 'uikit'])->createView();
        self::assertSame('uikit', $uikit->vars['icon_selector_theme']);
        self::assertSame('uikit', $uikit->vars['attr']['data-icon-selector-theme-value']);
        self::assertSame('bootstrap', $factory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons'], 'theme' => 'auto'])->createView()->vars['icon_selector_theme']);

        $this->expectException(InvalidOptionsException::class);
        $factory->create(IconSelectorType::class, null, ['theme' => 'material']);
    }

    public function testEmojiLabelsAreEmptyWithoutTranslator(): void
    {
        $view = $this->createEmojiFormFactory()->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons'], 'emoji' => true])->createView();

        self::assertSame('{}', $view->vars['attr']['data-icon-selector-emoji-labels']);
    }

    public function testSubmittingEmojiIsValidatedOnlyWhenEnabled(): void
    {
        $factory = $this->createEmojiFormFactory();

        $ok = $factory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons'], 'emoji' => true]);
        $ok->submit('emoji:👩🏽‍💻');
        self::assertTrue($ok->isSynchronized());
        self::assertSame('emoji:👩🏽‍💻', $ok->getData());

        foreach (['emoji:rocket', 'emoji:🚀🚀', "emoji:\u{202E}🚀", 'emoji:<b>'] as $bad) {
            $form = $factory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons'], 'emoji' => true]);
            $form->submit($bad);
            self::assertFalse($form->isSynchronized(), $bad);
        }

        // Icons keep working next to emoji.
        $icon = $factory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons'], 'emoji' => true]);
        $icon->submit('heroicons-outline:home');
        self::assertSame('heroicons-outline:home', $icon->getData());
    }

    public function testIconPrefixesRestrictChoicesSubmissionAndTheBrowserConfig(): void
    {
        $factory = $this->createEmojiFormFactory();
        $form    = $factory->create(IconSelectorType::class, null, ['icon_sets' => ['heroicons', 'bootstrap-icons'], 'icon_prefixes' => ['bi', 'bi']]);
        $view    = $form->createView();

        $values = array_map(static fn (ChoiceView $c): string => $c->value, $view->vars['choices']);
        self::assertNotSame([], $values);
        foreach ($values as $value) {
            self::assertStringStartsWith('bi:', $value);
        }
        self::assertSame('bi', $view->vars['attr']['data-icon-selector-prefixes-value']);
        self::assertStringEndsWith('/config#prefixes=bi', $view->vars['attr']['data-icon-selector-config-url-value']);

        $ok = $factory->create(IconSelectorType::class, null, ['icon_prefixes' => ['tabler']]);
        $ok->submit('tabler:home');
        self::assertSame('tabler:home', $ok->getData());

        $bad = $factory->create(IconSelectorType::class, null, ['icon_prefixes' => ['tabler']]);
        $bad->submit('lucide:rocket');
        self::assertFalse($bad->isSynchronized());

        $both = $factory->create(IconSelectorType::class, null, ['icon_prefixes' => ['tabler'], 'emoji' => true]);
        $both->submit('emoji:🚀');
        self::assertSame('emoji:🚀', $both->getData());

        $icons = $factory->create(IconSelectorType::class, null, ['icons' => ['tabler:home', 'bi:house'], 'icon_prefixes' => ['tabler']])->createView();
        self::assertSame(['tabler:home'], array_map(static fn (ChoiceView $c): string => $c->value, $icons->vars['choices']));
    }

    public function testIconPrefixesRejectsMalformedPrefixes(): void
    {
        $this->expectException(InvalidOptionsException::class);
        $this->createEmojiFormFactory()->create(IconSelectorType::class, null, ['icon_prefixes' => ['Tabler!']]);
    }

    private function createEmojiFormFactory(?TranslatorInterface $translator = null): FormFactoryInterface
    {
        $type = new IconSelectorType(
            new IconListProvider(['heroicons']),
            ['heroicons'],
            '/api/icons',
            null,
            new SvgSanitizer(),
            false,
            new EmojiCatalog(),
            '/emoji.json',
            $translator,
        );

        return (new FormFactoryBuilder())
            ->addExtension(new CoreExtension(null, new CachingFactoryDecorator(new DefaultChoiceListFactory())))
            ->addType($type)
            ->getFormFactory();
    }

    private function createFormFactory(IconListProvider $provider, CachingFactoryDecorator $decorator): FormFactoryInterface
    {
        return (new FormFactoryBuilder())
            ->addExtension(new CoreExtension(null, $decorator))
            ->addType($this->createType($provider, ['heroicons'], '/api/icons'))
            ->getFormFactory();
    }

    /**
     * @param FormInterface<mixed> $form
     *
     * @return list<mixed>
     */
    private function listChoices(FormInterface $form): array
    {
        $choiceList = $form->getConfig()->getAttribute('choice_list');
        self::assertInstanceOf(ChoiceListInterface::class, $choiceList);

        return array_values($choiceList->getChoices());
    }

    /**
     * @return array<mixed>
     */
    private function cachedEntries(CachingFactoryDecorator $decorator, string $property): array
    {
        $entries = (new ReflectionProperty(CachingFactoryDecorator::class, $property))->getValue($decorator);
        self::assertIsArray($entries);

        return $entries;
    }

    /** Source ux_icons_local: the picker offers the committed icons only and refuses any other submitted id. */
    public function testUxIconsLocalOffersAndAcceptsOnlyCommittedIcons(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->expects(self::never())->method('renderIcon');
        $provider = new IconListProvider(['tabler'], false, null, 'ux_icons_local', new LocalUxIconsScanner(dirname(__DIR__, 2) . '/Fixtures/ux-icons'));
        $factory  = (new FormFactoryBuilder())
            ->addExtension(new CoreExtension())
            ->addType(new IconSelectorType($provider, ['tabler'], '/api/icon-selector/icons', $renderer, new SvgSanitizer(), source: 'ux_icons_local'))
            ->getFormFactory();

        $view = $factory->create(IconSelectorType::class)->createView();
        self::assertSame(['tabler:home', 'tabler:star', 'tabler:user-circle'], array_map(static fn (ChoiceView $c): string => $c->value, $view->vars['choices']));

        $ok = $factory->create(IconSelectorType::class);
        $ok->submit('tabler:star');
        self::assertSame('tabler:star', $ok->getData());

        $bad = $factory->create(IconSelectorType::class);
        $bad->submit('tabler:settings');
        self::assertFalse($bad->isSynchronized(), 'A well-formed id that is not committed must be refused without asking the renderer.');
    }

    public function testStylesheetUrlUsesTheAssetPackageAndCanBeDisabled(): void
    {
        $packages = new Packages(new PathPackage('/', new EmptyVersionStrategy()), ['nowo_icon_selector' => new PathPackage('/sub/bundles/nowoiconselector', new EmptyVersionStrategy())]);
        $type     = new IconSelectorType(new IconListProvider(['heroicons']), ['heroicons'], '/api/icon-selector/icons', packages: $packages);
        $view     = (new FormFactoryBuilder())->addType($type)->getFormFactory()->create(IconSelectorType::class)->createView();
        self::assertSame('/sub/bundles/nowoiconselector/icon-selector.css', $view->vars['stylesheet_url']);

        // Asset package not registered: the fixed bundle path is used.
        $type = new IconSelectorType(new IconListProvider(['heroicons']), ['heroicons'], '/api/icon-selector/icons', packages: new Packages());
        $view = (new FormFactoryBuilder())->addType($type)->getFormFactory()->create(IconSelectorType::class)->createView();
        self::assertSame('/bundles/nowoiconselector/icon-selector.css', $view->vars['stylesheet_url']);

        $type = new IconSelectorType(new IconListProvider(['heroicons']), ['heroicons'], '/api/icon-selector/icons', includeStylesheet: false);
        $view = (new FormFactoryBuilder())->addType($type)->getFormFactory()->create(IconSelectorType::class)->createView();
        self::assertNull($view->vars['stylesheet_url']);
    }

    public function testFallbackStylesheetUrlKeepsTheRequestBasePath(): void
    {
        $requestStack = new RequestStack();
        $requestStack->push(Request::create('http://localhost/sub/app/index.php/page', 'GET', [], [], [], ['SCRIPT_NAME' => '/sub/app/index.php', 'SCRIPT_FILENAME' => '/srv/sub/app/index.php']));
        $type = new IconSelectorType(new IconListProvider(['heroicons']), ['heroicons'], '/api/icon-selector/icons', requestStack: $requestStack);
        $view = (new FormFactoryBuilder())->addType($type)->getFormFactory()->create(IconSelectorType::class)->createView();

        self::assertSame('/sub/app/bundles/nowoiconselector/icon-selector.css', $view->vars['stylesheet_url']);
    }

    /** SA-D1: by default Nelmio is never asked for a style nonce (that would disable 'unsafe-inline' page-wide). */
    public function testStylesheetNonceIsNotRequestedByDefault(): void
    {
        $provider = $this->nonceProvider('nelmio-nonce');
        $type     = new IconSelectorType(new IconListProvider(['heroicons']), ['heroicons'], '/api/icon-selector/icons', cspNonceProvider: $provider);
        $view     = (new FormFactoryBuilder())->addType($type)->getFormFactory()->create(IconSelectorType::class)->createView();

        self::assertNull($view->vars['stylesheet_nonce']);
        self::assertSame(0, $provider->calls);
    }

    public function testStylesheetNonceOptInPrefersTheRequestAttribute(): void
    {
        $request = Request::create('/');
        $request->attributes->set('csp_nonce', 'from-request');
        $requestStack = new RequestStack();
        $requestStack->push($request);
        $provider = $this->nonceProvider('nelmio-nonce');

        $type = new IconSelectorType(new IconListProvider(['heroicons']), ['heroicons'], '/api/icon-selector/icons', requestStack: $requestStack, cspNonceProvider: $provider, stylesheetNonce: true);
        $view = (new FormFactoryBuilder())->addType($type)->getFormFactory()->create(IconSelectorType::class)->createView();
        self::assertSame('from-request', $view->vars['stylesheet_nonce']);
        self::assertSame(0, $provider->calls);

        // No request attribute: fall back to the Nelmio listener.
        $type = new IconSelectorType(new IconListProvider(['heroicons']), ['heroicons'], '/api/icon-selector/icons', cspNonceProvider: $provider, stylesheetNonce: true);
        $view = (new FormFactoryBuilder())->addType($type)->getFormFactory()->create(IconSelectorType::class)->createView();
        self::assertSame('nelmio-nonce', $view->vars['stylesheet_nonce']);
        self::assertSame(1, $provider->calls);

        $failing = new class {
            public function getNonce(string $usage): string
            {
                throw new RuntimeException('no request');
            }
        };
        foreach ([null, new stdClass(), $failing] as $candidate) {
            $type = new IconSelectorType(new IconListProvider(['heroicons']), ['heroicons'], '/api/icon-selector/icons', cspNonceProvider: $candidate, stylesheetNonce: true);
            $view = (new FormFactoryBuilder())->addType($type)->getFormFactory()->create(IconSelectorType::class)->createView();
            self::assertNull($view->vars['stylesheet_nonce']);
        }
    }

    private function nonceProvider(string $nonce): RecordingCspNonceProvider
    {
        return new RecordingCspNonceProvider($nonce);
    }

    /** SA-L5: a stored id that is no longer a choice is exposed so tom_select keeps it selected. */
    public function testStoredValueOutsideTheChoicesIsKeptForTheView(): void
    {
        $factory = (new FormFactoryBuilder())->addType(new IconSelectorType(new IconListProvider(['tabler']), ['tabler']))->getFormFactory();

        $gone = $factory->create(IconSelectorType::class, 'tabler:gone-icon', ['mode' => 'tom_select'])->createView();
        self::assertSame('tabler:gone-icon', $gone->vars['stored_value_option']);

        $listed = $factory->create(IconSelectorType::class, 'tabler:home', ['mode' => 'tom_select'])->createView();
        self::assertNull($listed->vars['stored_value_option']);

        $emoji = $factory->create(IconSelectorType::class, 'emoji:🚀', ['mode' => 'tom_select'])->createView();
        self::assertNull($emoji->vars['stored_value_option']);
    }
}
