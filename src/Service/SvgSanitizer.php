<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

use DOMDocument;
use DOMElement;
use DOMNode;

use function in_array;
use function is_string;
use function libxml_clear_errors;
use function libxml_use_internal_errors;
use function strtolower;
use function trim;

use const LIBXML_COMPACT;
use const LIBXML_NONET;
use const LIBXML_PARSEHUGE;

/**
 * Sanitizes SVG markup to reduce XSS risk when SVG is injected into the DOM (e.g. via innerHTML).
 *
 * Uses DOM parsing with an element/attribute allowlist instead of regex-only stripping.
 */
final readonly class SvgSanitizer
{
    /** @var list<string> */
    private const ALLOWED_TAGS = [
        'svg',
        'g',
        'path',
        'circle',
        'rect',
        'line',
        'polyline',
        'polygon',
        'ellipse',
        'defs',
        'lineargradient',
        'radialgradient',
        'stop',
        'clippath',
        'mask',
        'title',
        'desc',
        'use',
    ];

    /** @var list<string> */
    private const ALLOWED_ATTRIBUTES = [
        'xmlns',
        'viewbox',
        'width',
        'height',
        'fill',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
        'd',
        'cx',
        'cy',
        'r',
        'rx',
        'ry',
        'x',
        'y',
        'x1',
        'y1',
        'x2',
        'y2',
        'points',
        'transform',
        'opacity',
        'fill-opacity',
        'stroke-opacity',
        'class',
        'id',
        'offset',
        'stop-color',
        'stop-opacity',
        'clip-path',
        'mask',
        'preserveaspectratio',
        'role',
        'aria-hidden',
        'aria-label',
        'focusable',
    ];

    /**
     * Sanitizes SVG string by removing unsafe elements and attributes.
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

        $previous = libxml_use_internal_errors(true);
        libxml_clear_errors();

        $document = new DOMDocument();
        $loaded   = $document->loadXML(
            $svg,
            LIBXML_NONET | LIBXML_COMPACT | LIBXML_PARSEHUGE,
        );

        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if ($loaded === false || !$document->documentElement instanceof DOMElement) {
            return $this->sanitizeWithRegexFallback($svg);
        }

        $this->sanitizeElement($document->documentElement);

        $output = $document->saveXML($document->documentElement);

        return is_string($output) ? $output : '';
    }

    private function sanitizeElement(DOMElement $element): void
    {
        $tag = strtolower($element->tagName);
        if (!in_array($tag, self::ALLOWED_TAGS, true)) {
            $parent = $element->parentNode;
            if ($parent instanceof DOMNode) {
                $parent->removeChild($element);
            }

            return;
        }

        if ($element->hasAttributes()) {
            $toRemove = [];
            foreach ($element->attributes as $attribute) {
                $name = strtolower($attribute->name);
                if (str_starts_with($name, 'on') || !in_array($name, self::ALLOWED_ATTRIBUTES, true)) {
                    $toRemove[] = $attribute->name;
                    continue;
                }

                if (in_array($name, ['href', 'xlink:href'], true) && !$this->isSafeFragmentReference($attribute->value)) {
                    $toRemove[] = $attribute->name;
                }
            }

            foreach ($toRemove as $name) {
                $element->removeAttribute($name);
            }
        }

        $children = [];
        foreach ($element->childNodes as $child) {
            $children[] = $child;
        }

        foreach ($children as $child) {
            if ($child instanceof DOMElement) {
                $this->sanitizeElement($child);
            }
        }
    }

    private function isSafeFragmentReference(string $value): bool
    {
        $value = trim($value);

        return $value !== '' && str_starts_with($value, '#');
    }

    private function sanitizeWithRegexFallback(string $svg): string
    {
        $svg = (string) preg_replace('/<script\b[^>]*>.*?<\/script\s*>/is', '', $svg);
        $svg = (string) preg_replace('/\s+on[a-z]+\s*=\s*["\'][^"\']*["\']/i', '', $svg);
        $svg = (string) preg_replace('/<(foreignobject|iframe|object|embed)\b[^>]*>.*?<\/\1\s*>/is', '', $svg);

        return $svg;
    }
}
