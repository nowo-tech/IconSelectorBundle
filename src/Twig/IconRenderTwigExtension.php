<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Twig;

use Nowo\IconSelectorBundle\Emoji\EmojiCatalogInterface;
use Nowo\IconSelectorBundle\Emoji\IconValue;
use Nowo\IconSelectorBundle\Service\SvgSanitizerInterface;
use Symfony\UX\Icons\IconRendererInterface;
use Throwable;
use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;
use Twig\TwigFunction;

use function htmlspecialchars;
use function is_bool;
use function is_scalar;
use function preg_match;
use function strtolower;
use function trim;

use const ENT_QUOTES;
use const ENT_SUBSTITUTE;

/**
 * Renders a stored icon value: "prefix:name" icons through UX Icons + the SVG sanitizer, "emoji:<grapheme>" values as
 * escaped text in <span role="img" aria-label="name">.
 *
 *     {{ nowo_icon_selector_render(page.icon, {class: 'me-1'}) }}
 *     {{ page.icon|nowo_icon_selector_render }}
 *     {% if nowo_icon_selector_is_emoji(page.icon) %}…{% endif %}
 *
 * Invalid emoji, unknown icons and renderer failures render ''. Stateless (safe in FrankenPHP worker mode).
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final class IconRenderTwigExtension extends AbstractExtension
{
    /** Attribute names accepted on the emoji span (event handlers are always dropped). */
    private const ATTRIBUTE_NAME_PATTERN = '/^[a-z][a-z0-9_.:-]*$/';

    public function __construct(
        private readonly EmojiCatalogInterface $emojiCatalog,
        private readonly SvgSanitizerInterface $svgSanitizer,
        private readonly ?IconRendererInterface $iconRenderer = null,
    ) {
    }

    /**
     * @return list<TwigFunction>
     */
    public function getFunctions(): array
    {
        return [
            new TwigFunction('nowo_icon_selector_render', $this->render(...), ['is_safe' => ['html']]),
            new TwigFunction('nowo_icon_selector_is_emoji', $this->isEmoji(...)),
            new TwigFunction('nowo_icon_selector_emoji_name', $this->emojiName(...)),
        ];
    }

    /**
     * @return list<TwigFilter>
     */
    public function getFilters(): array
    {
        return [
            new TwigFilter('nowo_icon_selector_render', $this->render(...), ['is_safe' => ['html']]),
        ];
    }

    /**
     * Whether $value is a valid "emoji:" value.
     */
    public function isEmoji(?string $value): bool
    {
        return $this->emojiName($value) !== null;
    }

    /**
     * CLDR name of a valid "emoji:" value, null otherwise.
     */
    public function emojiName(?string $value): ?string
    {
        $emoji = IconValue::emojiOf($value);

        return $emoji === null ? null : $this->emojiCatalog->getName($emoji);
    }

    /**
     * Renders the icon value as safe HTML ('' when it cannot be rendered).
     *
     * @param array<string, mixed> $attributes HTML attributes (e.g. class, title); for emoji, aria-label overrides the name
     */
    public function render(?string $value, array $attributes = []): string
    {
        if ($value === null || trim($value) === '') {
            return '';
        }

        if (IconValue::isEmoji($value)) {
            return $this->renderEmoji($value, $attributes);
        }

        if (!$this->iconRenderer instanceof IconRendererInterface) {
            return '';
        }

        try {
            return $this->svgSanitizer->sanitize($this->iconRenderer->renderIcon($value, $attributes));
        } catch (Throwable) {
            return '';
        }
    }

    /**
     * @param array<string, mixed> $attributes
     */
    private function renderEmoji(string $value, array $attributes): string
    {
        $emoji = IconValue::emojiOf($value);
        $name  = $emoji === null ? null : $this->emojiCatalog->getName($emoji);
        if ($emoji === null || $name === null) {
            return '';
        }

        $attrs = ['class' => 'nowo-icon-emoji', 'role' => 'img', 'aria-label' => $name];
        foreach ($attributes as $key => $attrValue) {
            $key = strtolower((string) $key);
            if (preg_match(self::ATTRIBUTE_NAME_PATTERN, $key) !== 1 || str_starts_with($key, 'on') || $key === 'role' || $key === 'style') {
                continue;
            }
            if ($attrValue === null || $attrValue === false) {
                continue;
            }
            if (!is_scalar($attrValue)) {
                continue;
            }
            $text        = is_bool($attrValue) ? $key : (string) $attrValue;
            $attrs[$key] = $key === 'class' ? trim('nowo-icon-emoji ' . $text) : $text;
        }

        $html = '<span';
        foreach ($attrs as $key => $attrValue) {
            $html .= ' ' . $key . '="' . $this->escape($attrValue) . '"';
        }

        return $html . '>' . $this->escape($emoji) . '</span>';
    }

    private function escape(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
