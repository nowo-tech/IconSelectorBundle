<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

use DOMAttr;
use DOMCdataSection;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMText;

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
 * Uses DOM parsing with an element/attribute allowlist instead of regex-only stripping. Only allowlisted
 * elements, allowlisted attributes and text survive: processing instructions, comments, CDATA sections,
 * doctypes and entity references are removed, because HTML parses them differently from XML once the
 * output is inserted with innerHTML.
 */
final readonly class SvgSanitizer implements SvgSanitizerInterface
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

    /**
     * HTML integration points inside SVG: their content is parsed with HTML rules on innerHTML, so they keep text only.
     *
     * @var list<string>
     */
    private const TEXT_ONLY_TAGS = ['title', 'desc'];

    private const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

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
     * @return string Sanitized SVG safe for injection into the DOM ('' when the input cannot be parsed as an SVG document)
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

        // Fail closed: markup that is not a well-formed <svg> document is dropped, never regex-"cleaned".
        if ($loaded === false
            || !$document->documentElement instanceof DOMElement
            || strtolower((string) $document->documentElement->localName) !== 'svg'
            || !in_array($document->documentElement->namespaceURI, [null, self::SVG_NAMESPACE], true)) {
            return '';
        }

        $root = $document->documentElement;
        $this->sanitizeElement($root);

        $output = $document->saveXML($root);

        return is_string($output) ? $output : '';
    }

    private function sanitizeElement(DOMElement $element): void
    {
        $tag          = strtolower($element->tagName);
        $namespaceUri = $element->namespaceURI;
        if (!in_array($tag, self::ALLOWED_TAGS, true)
            || ($namespaceUri !== null && $namespaceUri !== self::SVG_NAMESPACE)) {
            $parent = $element->parentNode;
            if ($parent instanceof DOMNode) {
                $parent->removeChild($element);
            }

            return;
        }

        if ($element->hasAttributes()) {
            /** @var list<DOMAttr> $toRemove */
            $toRemove = [];
            foreach ($element->attributes as $attribute) {
                $localName     = strtolower((string) $attribute->localName);
                $qualifiedName = strtolower($attribute->nodeName);

                // href / xlink:href: keep only same-document fragment references (#id).
                if ($localName === 'href') {
                    if (!$this->isSafeFragmentReference($attribute->value)) {
                        $toRemove[] = $attribute;
                    }

                    continue;
                }

                // Preserve xmlns and xmlns:* declarations used by SVG/xlink.
                if ($qualifiedName === 'xmlns' || str_starts_with($qualifiedName, 'xmlns:')) {
                    continue;
                }

                if (str_starts_with($localName, 'on') || !in_array($localName, self::ALLOWED_ATTRIBUTES, true)) {
                    $toRemove[] = $attribute;
                }
            }

            foreach ($toRemove as $attribute) {
                $namespaceUri = $attribute->namespaceURI;
                if (is_string($namespaceUri) && $namespaceUri !== '') {
                    $element->removeAttributeNS($namespaceUri, (string) $attribute->localName);
                } else {
                    $element->removeAttribute($attribute->name);
                }
            }
        }

        $children = [];
        foreach ($element->childNodes as $child) {
            $children[] = $child;
        }

        $textOnly = in_array($tag, self::TEXT_ONLY_TAGS, true);
        foreach ($children as $child) {
            if ($child instanceof DOMElement && !$textOnly) {
                $this->sanitizeElement($child);

                continue;
            }

            // Keep plain text only: CDATA (a DOMText subclass), comments, processing instructions,
            // entity references and, inside <title>/<desc>, child elements are removed.
            if ($child instanceof DOMText && !$child instanceof DOMCdataSection) {
                continue;
            }

            $element->removeChild($child);
        }
    }

    private function isSafeFragmentReference(string $value): bool
    {
        $value = trim($value);

        return $value !== '' && str_starts_with($value, '#');
    }
}
