<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Form;

use Nowo\IconSelectorBundle\Form\IconSelectorType;
use Nowo\IconSelectorBundle\Service\IconListProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormView;
use Symfony\Component\OptionsResolver\OptionsResolver;

use function count;

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
    private function createType(IconListProvider $provider, array $iconSets = [], string $iconsApiPath = ''): IconSelectorType
    {
        return new IconSelectorType($provider, $iconSets, $iconsApiPath);
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
        self::assertSame(\Symfony\Component\Form\Extension\Core\Type\ChoiceType::class, $type->getParent());
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
}
