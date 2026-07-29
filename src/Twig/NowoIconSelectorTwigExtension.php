<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Twig;

use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

/**
 * Exposes safe relative asset filenames for the bundle's named asset package.
 *
 * Use this function with asset(..., 'nowo_icon_selector') so the named Symfony asset package
 * provides the bundle base path while this helper only validates the relative filename.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final class NowoIconSelectorTwigExtension extends AbstractExtension
{
    /**
     * Returns the list of Twig functions provided by this extension.
     *
     * @return list<TwigFunction>
     */
    public function getFunctions(): array
    {
        return [
            new TwigFunction('nowo_icon_selector_asset_path', $this->assetPath(...), ['is_safe' => ['html']]),
        ];
    }

    /**
     * Safe character set for asset path segments (alphanumeric, dot, hyphen, underscore, slash for subpaths).
     * Rejects ".." and any character that could lead to path traversal or injection.
     */
    private const SAFE_FILENAME_PATTERN = '#^[a-zA-Z0-9._/-]+$#';

    /**
     * Returns a safe relative asset filename for a file in the bundle's public directory.
     *
     * The filename must not contain ".." and must match a safe character set to prevent path traversal.
     * Use only literal or controlled values (e.g. "icon-selector.js", "css/theme.css").
     *
     * @param string $filename Filename or path relative to the bundle asset dir (e.g. "icon-selector.js")
     *
     * @return string Relative filename suitable for asset(..., 'nowo_icon_selector')
     */
    public function assetPath(string $filename): string
    {
        $filename = ltrim($filename, '/');
        if ($filename === '' || str_contains($filename, '..') || preg_match(self::SAFE_FILENAME_PATTERN, $filename) !== 1) {
            return 'icon-selector.js';
        }

        return $filename;
    }
}
