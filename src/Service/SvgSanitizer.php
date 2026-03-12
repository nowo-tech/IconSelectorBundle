<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

/**
 * Sanitizes SVG markup to reduce XSS risk when SVG is injected into the DOM (e.g. via innerHTML).
 *
 * Removes script elements and event-handler attributes (onload, onerror, onclick, etc.)
 * so that even if the icon renderer or a custom source returns unsafe content, the
 * bundle does not expose it.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final readonly class SvgSanitizer
{
    /**
     * Sanitizes SVG string by removing script tags and event-handler attributes.
     *
     * @param string $svg Raw SVG markup (e.g. from IconRendererInterface::renderIcon)
     *
     * @return string Sanitized SVG safe for injection into the DOM
     */
    public function sanitize(string $svg): string
    {
        if ($svg === '') {
            return '';
        }

        $svg = $this->stripScriptTags($svg);

        return $this->stripEventAttributes($svg);
    }

    /**
     * Removes <script>...</script> and related tags (case-insensitive).
     */
    private function stripScriptTags(string $svg): string
    {
        return (string) preg_replace('/<script\b[^>]*>.*?<\/script\s*>/is', '', $svg);
    }

    /**
     * Removes HTML event attributes (onload, onerror, onclick, etc.) from all tags.
     */
    private function stripEventAttributes(string $svg): string
    {
        return (string) preg_replace('/\s+on[a-z]+\s*=\s*["\'][^"\']*["\']/i', '', $svg);
    }
}
