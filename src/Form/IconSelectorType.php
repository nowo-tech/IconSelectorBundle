<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Form;

use Nowo\IconSelectorBundle\Emoji\EmojiCatalogInterface;
use Nowo\IconSelectorBundle\Emoji\IconValue;
use Nowo\IconSelectorBundle\Form\ChoiceLoader\IconChoiceLoader;
use Nowo\IconSelectorBundle\Service\IconCatalogInterface;
use Nowo\IconSelectorBundle\Service\IconSource;
use Nowo\IconSelectorBundle\Service\SvgSanitizerInterface;
use Nowo\IconSelectorBundle\Service\WidgetTheme;
use Symfony\Component\Asset\Packages;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\ChoiceList\ChoiceList;
use Symfony\Component\Form\ChoiceList\Loader\ChoiceLoaderInterface;
use Symfony\Component\Form\ChoiceList\View\ChoiceView;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormView;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\OptionsResolver\Exception\InvalidOptionsException;
use Symfony\Component\OptionsResolver\Options;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Contracts\Translation\TranslatorInterface;
use Symfony\UX\Icons\IconRendererInterface;
use Throwable;

use function array_slice;
use function count;
use function hash;
use function in_array;
use function is_array;
use function is_string;
use function json_encode;
use function method_exists;
use function rawurlencode;
use function serialize;
use function sprintf;

use const JSON_THROW_ON_ERROR;
use const JSON_UNESCAPED_UNICODE;
use const PREG_SPLIT_NO_EMPTY;

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

    /** Bundle stylesheet (built next to icon-selector.js); linked by the form themes when include_stylesheet is true. */
    private const STYLESHEET = 'icon-selector.css';

    /** Translation domain of the picker's own texts (placeholder, search box, empty list, filters, emoji tab). */
    public const TRANSLATION_DOMAIN = 'NowoIconSelectorBundle';

    /** Default keys of the placeholder options: kept in the bundle domain whatever the field's translation_domain. */
    private const DEFAULT_PLACEHOLDER        = 'placeholder';
    private const DEFAULT_SEARCH_PLACEHOLDER = 'search_placeholder';

    /** English texts used when no translator is available (same as the en catalogue). */
    private const FALLBACK_TEXTS = [
        'placeholder'        => 'Choose icon...',
        'search_placeholder' => 'Search icons...',
        'no_icons'           => 'No icons available.',
        'filter.all'         => 'All',
        'filter.category'    => 'Category:',
        'filter.sets'        => 'Icon sets',
        'filter.categories'  => 'Categories',
    ];

    /** Request attribute holding the per-request CSP nonce (nowo-tech HttpHardening convention). */
    private const CSP_NONCE_ATTRIBUTE = 'csp_nonce';

    /**
     * @param list<string> $iconSets Enabled icon set names from config (used when icon_sets option is null)
     * @param IconRendererInterface|null $iconRenderer Optional renderer to verify submitted icon IDs exist (e.g. via Iconify)
     * @param bool $debug When true, frontend shows all console logs; when false, only "script loaded"
     * @param EmojiCatalogInterface|null $emojiCatalog Emoji catalogue used when a field enables the emoji option
     * @param string $emojiDataUrl Default URL of the bundled emoji dataset (JSON) for the picker
     * @param TranslatorInterface|null $translator Translates the emoji picker labels passed to the frontend
     * @param string $source Effective icon source (see {@see IconSource}); with ux_icons_local only listed icons are accepted
     * @param bool $includeStylesheet When true, the theme links the bundle stylesheet next to the widget
     * @param Packages|null $packages Asset packages (symfony/asset) used to build the stylesheet URL; null = fixed bundle path
     * @param RequestStack|null $requestStack Current request (base path of the fallback stylesheet URL); read per call, never stored
     * @param object|null $cspNonceProvider Optional CSP listener exposing getNonce('style') (NelmioSecurityBundle
     *                                      nelmio_security.csp_listener); asked only when $stylesheetNonce is true and
     *                                      the request carries no "csp_nonce" attribute
     * @param bool $stylesheetNonce Opt-in (stylesheet_nonce): add a CSP nonce to the stylesheet <link>
     * @param string $theme 1.8: resolved widget look ("uikit" or "bootstrap", see {@see WidgetTheme}); a field's "theme"
     *                      option overrides it
     */
    public function __construct(
        private readonly IconCatalogInterface $iconListProvider,
        private readonly array $iconSets = [],
        private readonly string $iconsApiPath = '/api/icon-selector/icons',
        private readonly ?IconRendererInterface $iconRenderer = null,
        private readonly ?SvgSanitizerInterface $svgSanitizer = null,
        private readonly bool $debug = false,
        private readonly ?EmojiCatalogInterface $emojiCatalog = null,
        private readonly string $emojiDataUrl = '/bundles/nowoiconselector/emoji-data.json',
        private readonly ?TranslatorInterface $translator = null,
        private readonly string $source = 'bundle',
        private readonly bool $includeStylesheet = true,
        private readonly ?Packages $packages = null,
        private readonly ?RequestStack $requestStack = null,
        private readonly ?object $cspNonceProvider = null,
        private readonly bool $stylesheetNonce = false,
        private readonly string $theme = 'bootstrap',
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
        // The field's own domain as FormType resolved it (null option = the parent form's domain): only the texts the
        // host passes (a custom placeholder) are translated there; the picker's own texts use the bundle domain.
        $hostDomain    = $view->vars['translation_domain'] ?? $options['translation_domain'];
        $effectiveSets = $options['icon_sets'] ?? $this->iconSets;
        $iconsRaw      = is_array($options['icons']) && $options['icons'] !== [] ? $options['icons'] : $this->iconListProvider->getIconsForSets($effectiveSets);
        /** @var list<string>|null $prefixes */
        $prefixes = $options['icon_prefixes'] ?? null;
        /** @var list<string> $icons */
        $icons = $this->filterByPrefixes(array_values($iconsRaw), $prefixes);
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
        $view->vars['attr']['data-controller']                     = $this->withIconSelectorController((string) ($view->vars['attr']['data-controller'] ?? ''));
        $view->vars['attr']['data-icon-selector-mode-value']       = $options['mode'];
        $view->vars['attr']['data-icon-selector-icons-url-value']  = $iconsApiPath;
        $view->vars['attr']['data-icon-selector-config-url-value'] = $view->vars['config_path'];
        $view->vars['attr']['data-icon-selector-debug-value']      = $this->debug ? '1' : '0';
        $view->vars['stylesheet_url']                              = $this->includeStylesheet ? $this->stylesheetUrl() : null;
        $view->vars['stylesheet_nonce']                            = $this->includeStylesheet ? $this->styleNonce() : null;
        $theme                                                     = $this->resolveTheme($options['theme'] ?? null);
        $view->vars['icon_selector_theme']                         = $theme->value;
        $view->vars['attr']['data-icon-selector-theme-value']      = $theme->value;
        $view->vars['placeholder_text']                            = $this->hostText($options['placeholder'] ?? null, self::DEFAULT_PLACEHOLDER, $hostDomain);
        $view->vars['search_placeholder_text']                     = $this->hostText($options['search_placeholder'] ?? null, self::DEFAULT_SEARCH_PLACEHOLDER, $hostDomain);
        $view->vars['empty_text']                                  = $this->ownText('no_icons');
        // Every form theme renders `attributes`, so the browser widgets get their texts from here (never English
        // defaults, never a raw key).
        $view->vars['attr']['data-icon-selector-search-placeholder'] = $view->vars['search_placeholder_text'];
        $view->vars['attr']['data-icon-selector-empty-text']         = $view->vars['empty_text'];
        $view->vars['attr']['data-icon-selector-labels']             = json_encode([
            'placeholder'        => $view->vars['placeholder_text'],
            'search_placeholder' => $view->vars['search_placeholder_text'],
            'empty'              => $view->vars['empty_text'],
            'all'                => $this->ownText('filter.all'),
            'category'           => $this->ownText('filter.category'),
            'sets'               => $this->ownText('filter.sets'),
            'categories'         => $this->ownText('filter.categories'),
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        if ($prefixes !== null) {
            // The browser widgets read the restriction from the attribute and from the config URL fragment (never sent).
            $view->vars['config_path'] .= '#prefixes=' . rawurlencode(implode(',', $prefixes));
            $view->vars['attr']['data-icon-selector-config-url-value'] = $view->vars['config_path'];
            $view->vars['attr']['data-icon-selector-prefixes-value']   = implode(',', $prefixes);
        }
        $currentValue                               = is_string($view->vars['value'] ?? null) ? $view->vars['value'] : '';
        $view->vars['tom_select_preloaded_options'] = $options['mode'] === self::MODE_TOM_SELECT
            ? $this->buildTomSelectPreloadedOptions($choices, $currentValue)
            : [];
        // A stored icon id that is no longer a choice (catalogue or source changed) stays the selected <option> in
        // tom_select, so a re-save submits it (accepted or refused with an error) instead of silently clearing it.
        $view->vars['stored_value_option'] = $currentValue !== '' && !isset($choices[$currentValue]) && !IconValue::isEmoji($currentValue)
            ? $currentValue
            : null;

        $emoji                     = ($options['emoji'] ?? false) === true && $this->emojiCatalog instanceof EmojiCatalogInterface;
        $view->vars['emoji']       = $emoji;
        $view->vars['emoji_value'] = null;
        $view->vars['emoji_name']  = null;
        if ($emoji) {
            $view->vars['attr']['data-icon-selector-emoji-value']     = '1';
            $view->vars['attr']['data-icon-selector-emoji-url-value'] = $options['emoji_data_url'] ?? $this->emojiDataUrl;
            $view->vars['attr']['data-icon-selector-emoji-labels']    = $this->emojiLabels();
            $grapheme                                                 = IconValue::emojiOf($currentValue);
            if ($grapheme !== null && $this->emojiCatalog->isValid($grapheme)) {
                $view->vars['emoji_value'] = $grapheme;
                $view->vars['emoji_name']  = $this->emojiCatalog->getName($grapheme);
            }
        }
    }

    /**
     * URL of the bundle stylesheet: through the nowo_icon_selector asset package when symfony/asset is available
     * (keeps the host base path and versioning), else the public bundle path after assets:install.
     *
     * @return string Stylesheet URL
     */
    private function stylesheetUrl(): string
    {
        if ($this->packages instanceof Packages) {
            try {
                return $this->packages->getUrl(self::STYLESHEET, 'nowo_icon_selector');
            } catch (Throwable) {
                // Package not registered (framework assets disabled): fall back to the fixed bundle path.
            }
        }

        // Without the asset package: keep the host base path (app served from a subdirectory).
        $basePath = $this->requestStack?->getCurrentRequest()?->getBasePath() ?? '';

        return $basePath . '/bundles/nowoiconselector/' . self::STYLESHEET;
    }

    /**
     * CSP nonce for the stylesheet <link> (opt-in, stylesheet_nonce: true; needed only for a pure-nonce
     * style-src-elem policy without 'self'). An existing nonce is read from the "csp_nonce" request attribute
     * (nowo-tech HttpHardening convention). Only then is NelmioSecurityBundle asked: getNonce('style') creates a
     * style nonce, which makes browsers ignore 'unsafe-inline' for every other inline style, so it never happens
     * by default.
     */
    private function styleNonce(): ?string
    {
        if (!$this->stylesheetNonce) {
            return null;
        }
        $existing = $this->requestStack?->getCurrentRequest()?->attributes->get(self::CSP_NONCE_ATTRIBUTE);
        if (is_string($existing) && $existing !== '') {
            return $existing;
        }
        if ($this->cspNonceProvider === null || !method_exists($this->cspNonceProvider, 'getNonce')) {
            return null;
        }
        try {
            $nonce = $this->cspNonceProvider->getNonce('style');
        } catch (Throwable) {
            return null;
        }

        return is_string($nonce) && $nonce !== '' ? $nonce : null;
    }

    /**
     * Keeps the icon ids whose prefix is in $prefixes (all of them when $prefixes is null).
     *
     * @param list<string> $icons
     * @param list<string>|null $prefixes
     *
     * @return list<string>
     */
    private function filterByPrefixes(array $icons, ?array $prefixes): array
    {
        if ($prefixes === null) {
            return $icons;
        }

        return array_values(array_filter($icons, static fn (string $id): bool => in_array(explode(':', $id, 2)[0], $prefixes, true)));
    }

    /** Translation keys of the emoji picker labels (frontend label key => translation key). */
    private const EMOJI_LABEL_KEYS = [
        'tablist'       => 'emoji.tablist',
        'tab_icons'     => 'emoji.tab_icons',
        'tab_emoji'     => 'emoji.tab_emoji',
        'search'        => 'emoji.search',
        'group_all'     => 'emoji.group_all',
        'group'         => 'emoji.group',
        'tone'          => 'emoji.tone',
        'tone_default'  => 'emoji.tone_default',
        'selected'      => 'emoji.selected',
        'none_selected' => 'emoji.none_selected',
        'empty'         => 'emoji.empty',
        'loading'       => 'emoji.loading',
        'error'         => 'emoji.error',
        'grid'          => 'emoji.grid',
    ];

    /** Translation keys of the five skin tones, light to dark. */
    private const EMOJI_TONE_KEYS = ['emoji.tone_1', 'emoji.tone_2', 'emoji.tone_3', 'emoji.tone_4', 'emoji.tone_5'];

    /**
     * JSON object with the translated emoji picker labels (the frontend falls back to English per missing key).
     * 1.8: always the bundle domain (the picker's own texts), whatever the field's translation_domain.
     */
    private function emojiLabels(): string
    {
        if (!$this->translator instanceof TranslatorInterface) {
            return '{}';
        }
        $labels = [];
        foreach (self::EMOJI_LABEL_KEYS as $key => $id) {
            $labels[$key] = $this->translateOwn($id);
        }
        $labels['tones'] = array_map($this->translateOwn(...), self::EMOJI_TONE_KEYS);

        return json_encode($labels, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Translates $id in the bundle domain; returns '' when untranslated (frontend default wins).
     */
    private function translateOwn(string $id): string
    {
        $text = $this->translator?->trans($id, [], self::TRANSLATION_DOMAIN) ?? $id;

        return $text !== $id ? $text : '';
    }

    /**
     * One of the picker's own texts (bundle domain), with the English text when it is not translated.
     *
     * @param key-of<self::FALLBACK_TEXTS> $key Translation key
     */
    private function ownText(string $key): string
    {
        $text = $this->translateOwn($key);

        return $text !== '' ? $text : self::FALLBACK_TEXTS[$key];
    }

    /**
     * Text of a placeholder option: the bundle default key (or no value) is the picker's own text (bundle domain);
     * a value passed by the host is translated in the field's domain (as Symfony does for labels), or printed as is
     * with translation_domain false.
     *
     * @param mixed $value Option value (placeholder / search_placeholder)
     * @param key-of<self::FALLBACK_TEXTS> $defaultKey Bundle key of that option
     * @param mixed $domain Field translation domain (false = no translation, null = default domain)
     */
    private function hostText(mixed $value, string $defaultKey, mixed $domain): string
    {
        if (!is_string($value) || $value === '' || $value === $defaultKey) {
            return $this->ownText($defaultKey);
        }
        if ($domain === false || !$this->translator instanceof TranslatorInterface) {
            return $value;
        }

        return $this->translator->trans($value, [], is_string($domain) ? $domain : null);
    }

    /**
     * Concrete look of this field: its "theme" option ("auto" or null = the configured theme).
     *
     * @param mixed $option Field option theme
     */
    private function resolveTheme(mixed $option): WidgetTheme
    {
        $theme = is_string($option) ? WidgetTheme::tryFrom($option) : null;
        if ($theme === null || $theme === WidgetTheme::Auto) {
            return WidgetTheme::tryFrom($this->theme) ?? WidgetTheme::Bootstrap;
        }

        return $theme;
    }

    /**
     * Appends the "icon-selector" Stimulus controller once (keeps any other controllers, drops duplicates).
     *
     * @param string $controllers Existing space-separated data-controller value
     *
     * @return string Space-separated controllers including "icon-selector" exactly once
     */
    private function withIconSelectorController(string $controllers): string
    {
        $list   = preg_split('/\s+/', trim($controllers), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $list[] = 'icon-selector';

        return implode(' ', array_unique($list));
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
            // Only render ids that are real choices: the view value may be an arbitrary submitted string,
            // and rendering it could trigger an on-demand Iconify fetch for any icon name.
            if (isset($choices[$selectedId])) {
                $idsToPreload[] = $selectedId;
            }
        } else {
            $idsToPreload = array_slice(array_keys($choices), 0, 12);
        }

        $out = [];
        foreach ($idsToPreload as $id) {
            if ($id === '' || !isset($choices[$id])) {
                continue;
            }
            $label = $choices[$id];
            $svg   = '';
            try {
                // No style attribute (strict CSP); the sanitizer always dropped it, so the rendered icon is unchanged.
                $raw = $this->iconRenderer->renderIcon($id, ['class' => 'icon-selector-svg']);
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
            /** @var list<string>|null $prefixes */
            $prefixes = $options['icon_prefixes'];

            return $this->choicesFromIcons($this->filterByPrefixes($icons, $prefixes));
        }
        /** @var list<string> $sets */
        $sets              = $options['icon_sets'] ?? $this->iconSets;
        $iconsFromProvider = $this->iconListProvider->getIconsForSets($sets);
        /** @var list<string>|null $prefixes */
        $prefixes = $options['icon_prefixes'];

        return $this->choicesFromIcons($this->filterByPrefixes($iconsFromProvider, $prefixes));
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
            'choice_loader'             => $this->createChoiceLoader(...),
            'placeholder'               => 'placeholder',
            'search_placeholder'        => 'search_placeholder',
            'choice_value'              => ChoiceList::value($this, static fn ($choice) => $choice),
            'emoji'                     => false,
            'emoji_data_url'            => null,
            'icon_prefixes'             => null,
            'theme'                     => null,
        ]);
        $resolver->setAllowedValues('theme', [null, WidgetTheme::Auto->value, WidgetTheme::UiKit->value, WidgetTheme::Bootstrap->value]);
        $resolver->setInfo('theme', '1.8: look of this widget: "uikit" (UiKit design tokens, no Bootstrap classes), "bootstrap" (the 1.7 Bootstrap classes) or "auto"; null = the bundle configuration "theme".');
        $resolver->setAllowedTypes('icon_prefixes', ['null', 'string[]']);
        $resolver->setNormalizer('icon_prefixes', static function (Options $options, ?array $value): ?array {
            if ($value === null) {
                return null;
            }
            foreach ($value as $prefix) {
                if (preg_match('/^[a-z0-9-]+$/D', $prefix) !== 1) {
                    throw new InvalidOptionsException(sprintf('Invalid icon prefix "%s": expected [a-z0-9-]+.', $prefix));
                }
            }

            return array_values(array_unique($value));
        });
        $resolver->setInfo('icon_prefixes', 'Restricts the picker and the accepted values to these icon prefixes (e.g. ["tabler"]); null = no restriction.');
        $resolver->setAllowedTypes('emoji', 'bool');
        $resolver->setAllowedTypes('emoji_data_url', ['null', 'string']);
        $resolver->setInfo('emoji', 'Adds an "Emoji" tab; stores "emoji:<grapheme>" values validated against the bundled RGI emoji catalogue.');
        $resolver->setAllowedTypes('icons', ['null', 'array']);
        $resolver->setAllowedTypes('icon_sets', ['null', 'array']);
        $resolver->setAllowedTypes('translation_domain', ['null', 'string', 'bool']);
        $resolver->setAllowedTypes('search_placeholder', ['null', 'string']);
        $resolver->setAllowedValues('mode', ['direct', 'search', 'tom_select']);
    }

    /**
     * Wraps the loader with {@see ChoiceList::loader()} so Symfony's cached choice list factory reuses one list
     * (and one view) per distinct choice set instead of caching a new, never reused view on every render.
     *
     * @param Options $options Form options (choices, icon_sets)
     *
     * @phpstan-ignore missingType.generics (Options interface is generic in Symfony)
     */
    private function createChoiceLoader(Options $options): ChoiceLoaderInterface
    {
        /** @var array<string, string> $choices */
        $choices = $options['choices'];

        return ChoiceList::loader(
            $this,
            new IconChoiceLoader(
                $choices,
                // ux_icons_local: only the listed (committed) icons are valid; never ask the renderer about other names.
                IconSource::tryFrom($this->source) === IconSource::UxIconsLocal ? null : $this->iconRenderer,
                $options['emoji'] ? $this->emojiCatalog : null,
                $options['icon_prefixes'],
                IconSource::tryFrom($this->source) === IconSource::UxIconsLocal,
            ),
            [$options['icon_sets'] ?? $this->iconSets, hash('xxh128', serialize($choices)), (bool) $options['emoji'], $options['icon_prefixes']],
        );
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
