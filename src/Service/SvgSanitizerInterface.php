<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

/**
 * Port: sanitizes SVG markup before it is injected into the DOM.
 *
 * The bundle ships {@see SvgSanitizer} (allow-list) and aliases this interface to it. A host replaces the alias only
 * with an implementation at least as strict: the icon endpoint returns its output to the browser as HTML.
 */
interface SvgSanitizerInterface
{
    /**
     * @param string $svg Raw SVG markup
     *
     * @return string Sanitized SVG ('' when the input cannot be parsed as an SVG document)
     */
    public function sanitize(string $svg): string;
}
