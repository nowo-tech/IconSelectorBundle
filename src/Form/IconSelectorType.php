<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Form;

use Nowo\IconSelectorBundle\Form\ChoiceLoader\IconChoiceLoader;
use Nowo\IconSelectorBundle\Service\IconListProvider;
use Nowo\IconSelectorBundle\Service\SvgSanitizer;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\ChoiceList\View\ChoiceView;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormView;
use Symfony\Component\OptionsResolver\Options;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\UX\Icons\IconRendererInterface;
use Throwable;

use function array_slice;
use function count;
use function is_array;
use function is_string;

/**
 * Form type for selecting an icon (grid, search, or tom_select mode).
 *
 * In tom_select mode this renders a Symfony ChoiceType &lt;select&gt; enhanced with Tom Select
 * so the dropdown shows each option as SVG icon + label. Value is stored as a string
 * (e.g. "heroicons-outline:home", "bi:house").
 *
 * Icon libraries can be set globally via config (nowo_icon_selector.icon_sets) or per field
 * with the option icon_sets (e.g. ['heroicons'] or ['heroicons', 'bootstrap-icons']).
 *
 * Uses getParent() => ChoiceType::class so that buildForm/createChoiceList run on the
 * framework's ChoiceType instance (which has $choiceListFactory injected by FrameworkBundle).
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 *
 * @extends AbstractType<string>
 */
final class IconSelectorType extends AbstractType
{
    public const MODE_DIRECT     = 'direct';
    public const MODE_SEARCH     = 'search';
    public const MODE_TOM_SELECT = 'tom_select';

    /**
     * @param list<string> $iconSets Enabled icon set names from config (used when icon_sets option is null)
     * @param IconRendererInterface|null $iconRenderer Optional renderer to verify submitted icon IDs exist (e.g. via Iconify)
     * @param bool $debug When true, frontend shows all console logs; when false, only "script loaded"
     */
    public function __construct(
        private readonly IconListProvider $iconListProvider,
        private readonly array $iconSets = [],
        private readonly string $iconsApiPath = '/api/icon-selector/icons',
        private readonly ?IconRendererInterface $iconRenderer = null,
        private readonly ?SvgSanitizer $svgSanitizer = null,
        private readonly bool $debug = false,
    ) {
    }

    /**
     * Passes icon list, mode, placeholders and data attributes to the form view for the theme.
     *
     * @param FormView $view Form view to augment
     * @param FormInterface $form Form instance
     * @param array<string, mixed> $options Resolved form options
     *
     * @phpstan-ignore missingType.generics (FormInterface is generic in Symfony)
     */
    public function buildView(FormView $view, FormInterface $form, array $options): void
    {
        $view->vars['attr'] ??= [];
        $effectiveSets = $options['icon_sets'] ?? $this->iconSets;
        $iconsRaw      = is_array($options['icons']) && $options['icons'] !== [] ? $options['icons'] : $this->iconListProvider->getIconsForSets($effectiveSets);
        /** @var list<string> $icons */
        $icons = array_values($iconsRaw);
        if (isset($options['choices']) && is_array($options['choices']) && $options['choices'] !== []) {
            $choices = $this->normalizeChoicesForView($options['choices']);
        } else {
            $choices = $this->choicesFromIcons($icons);
        }
        $view->vars['choices']                                     = $this->buildChoiceViews($choices);
        $view->vars['placeholder']                                 = $options['placeholder'] ?? null;
        $view->vars['placeholder_in_choices']                      = $view->vars['placeholder'] !== null && $view->vars['placeholder'] !== false;
        $view->vars['mode']                                        = $options['mode'];
        $view->vars['icon_sets']                                   = $effectiveSets;
        $view->vars['icons_api_path']                              = $options['icons_api_path'] ?? $this->iconsApiPath;
        $view->vars['icons']                                       = $icons;
        $view->vars['translation_domain']                          = $options['translation_domain'];
        $view->vars['choice_translation_domain']                   = $options['choice_translation_domain'];
        $view->vars['search_placeholder']                          = $options['search_placeholder'];
        $iconsApiPath                                              = $options['icons_api_path'] ?? $this->iconsApiPath;
        $view->vars['config_path']                                 = preg_replace('#/icons/?$#', '/config', $iconsApiPath);
        $view->vars['attr']['data-controller']                     = trim(($view->vars['attr']['data-controller'] ?? '') . ' icon-selector');
        $view->vars['attr']['data-icon-selector-mode-value']       = $options['mode'];
        $view->vars['attr']['data-icon-selector-icons-url-value']  = $iconsApiPath;
        $view->vars['attr']['data-icon-selector-config-url-value'] = $view->vars['config_path'];
        $view->vars['attr']['data-icon-selector-debug-value']      = $this->debug ? '1' : '0';
        $currentValue                                              = is_string($view->vars['value'] ?? null) ? $view->vars['value'] : '';
        $view->vars['tom_select_preloaded_options']                = $options['mode'] === self::MODE_TOM_SELECT
            ? $this->buildTomSelectPreloadedOptions($choices, $currentValue)
            : [];
    }

    /**
     * Builds preloaded options for Tom Select to reduce initial visual lag.
     * If a value is selected, preloads that icon first. If empty, preloads a small first page.
     *
     * @param array<string, string> $choices Map of icon ID to label
     * @param string $selectedId Current selected value
     *
     * @return list<array{value: string, text: string, svg: string}>
     */
    private function buildTomSelectPreloadedOptions(array $choices, string $selectedId): array
    {
        if (!$this->iconRenderer instanceof IconRendererInterface || $choices === []) {
            return [];
        }

        $idsToPreload = [];
        if ($selectedId !== '') {
            $idsToPreload[] = $selectedId;
        } else {
            $idsToPreload = array_slice(array_keys($choices), 0, 12);
        }

        $out = [];
        foreach ($idsToPreload as $id) {
            if ($id === '') {
                continue;
            }
            $label = $choices[$id] ?? (explode(':', $id)[1] ?? $id);
            $svg   = '';
            try {
                $raw = $this->iconRenderer->renderIcon($id, [
                    'class' => 'icon-selector-svg',
                    'style' => 'width:1.25rem;height:1.25rem;fill:currentColor;',
                ]);
                $svg = $this->svgSanitizer?->sanitize($raw) ?? $raw;
            } catch (Throwable) {
                $svg = '';
            }

            $out[] = [
                'value' => $id,
                'text'  => $label,
                'svg'   => $svg,
            ];
        }

        return $out;
    }

    /**
     * Resolves choices from icons or icon_sets only (does not read options['choices']).
     * Use for the default value of 'choices' to avoid cyclic dependency in the options resolver.
     *
     * @param Options $options Form options (icons, icon_sets)
     *
     * @return array<string, string> Map of icon ID (value) to label
     *
     * @phpstan-ignore missingType.generics (Options interface is generic in Symfony)
     */
    private function resolveChoicesFromIconsAndSets(Options $options): array
    {
        $icons = $options['icons'];
        if (is_array($icons) && $icons !== []) {
            /** @var list<string> $icons */
            $icons = array_values($icons);

            return $this->choicesFromIcons($icons);
        }
        /** @var list<string> $sets */
        $sets              = $options['icon_sets'] ?? $this->iconSets;
        $iconsFromProvider = $this->iconListProvider->getIconsForSets($sets);

        return $this->choicesFromIcons($iconsFromProvider);
    }

    /**
     * Normalizes choices to id => label for the view (buildChoiceViews).
     * Accepts both id => label and label => id; if the key contains ':' it is treated as icon id.
     *
     * @param array<string, string> $choices Map of either icon ID to label or label to icon ID
     *
     * @return array<string, string> Map of icon ID to label
     */
    private function normalizeChoicesForView(array $choices): array
    {
        $firstKey = array_key_first($choices);
        if ($firstKey !== null && str_contains((string) $firstKey, ':')) {
            return $choices;
        }

        return array_flip($choices);
    }

    /**
     * Builds choice array (value => label) from a list of icon identifiers.
     * Uses full icon ID as key so icons with the same short name (e.g. archive in outline vs solid) are not overwritten.
     *
     * @param list<string> $icons Icon IDs (e.g. heroicons-outline:home)
     *
     * @return array<string, string> Map of full icon ID to label (last segment of ID)
     */
    private function choicesFromIcons(array $icons): array
    {
        $choices = [];
        foreach ($icons as $id) {
            $parts = explode(':', $id);
            /** @phpstan-ignore greater.alwaysTrue (explode returns non-empty for non-empty string) */
            $label        = (count($parts) > 0 ? end($parts) : null) ?: $id;
            $choices[$id] = $label;
        }

        return $choices;
    }

    /**
     * Builds ChoiceView list from a value => label map (icon ID => short label).
     *
     * @param array<string, string> $choices Map of icon ID to label
     *
     * @return list<ChoiceView> Choice views for the select options
     */
    private function buildChoiceViews(array $choices): array
    {
        $out = [];
        foreach ($choices as $value => $label) {
            $out[] = new ChoiceView($value, (string) $value, (string) $label);
        }

        return $out;
    }

    /**
     * Returns the parent form type used for choice list and form creation.
     *
     * @return string ChoiceType class name
     */
    public function getParent(): string
    {
        return ChoiceType::class;
    }

    /**
     * Defines default options and allowed types for mode, icon_sets, icons, translation and placeholders.
     *
     * @param OptionsResolver $resolver Options resolver to configure
     */
    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'mode'                      => 'direct',
            'icon_sets'                 => null,
            'icons_api_path'            => null,
            'icons'                     => null,
            'required'                  => true,
            'translation_domain'        => 'NowoIconSelectorBundle',
            'choice_translation_domain' => 'NowoIconSelectorBundle',
            'choices'                   => $this->resolveChoicesFromIconsAndSets(...),
            'choice_loader'             => fn (Options $options): IconChoiceLoader => new IconChoiceLoader($options['choices'], $this->iconRenderer),
            'placeholder'               => 'placeholder',
            'search_placeholder'        => 'search_placeholder',
            'choice_value'              => static fn ($choice) => $choice,
        ]);
        $resolver->setAllowedTypes('icons', ['null', 'array']);
        $resolver->setAllowedTypes('icon_sets', ['null', 'array']);
        $resolver->setAllowedTypes('translation_domain', ['null', 'string', 'bool']);
        $resolver->setAllowedTypes('search_placeholder', ['null', 'string']);
        $resolver->setAllowedValues('mode', ['direct', 'search', 'tom_select']);
    }

    /**
     * Returns the block prefix used for form theme blocks (e.g. icon_selector_widget).
     *
     * @return string Block prefix
     */
    public function getBlockPrefix(): string
    {
        return 'icon_selector';
    }
}
