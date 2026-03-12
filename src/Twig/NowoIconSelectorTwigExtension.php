<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Twig;

use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

/**
 * Exposes the bundle's public asset path for JS/CSS URLs in templates.
 *
 * Symfony assets:install uses the bundle name to build the path (e.g. NowoIconSelectorBundle
 * → "nowoiconselector"). Use this function so script/stylesheet URLs match the installed path.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final class NowoIconSelectorTwigExtension extends AbstractExtension
{
    /**
     * Directory name under public/bundles/ where the bundle's assets are installed.
     * Matches the output of `php bin/console assets:install` (derived from bundle class name).
     */
    public const ASSET_DIR = 'nowoiconselector';

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
     * Returns the asset path for a file in the bundle's public directory.
     *
     * The filename must not contain ".." and must match a safe character set to prevent path traversal.
     * Use only literal or controlled values (e.g. "icon-selector.js", "css/theme.css").
     *
     * @param string $filename Filename or path relative to the bundle asset dir (e.g. "icon-selector.js")
     *
     * @return string Path suitable for the asset() function (e.g. "bundles/nowoiconselector/icon-selector.js")
     */
    public function assetPath(string $filename): string
    {
        $filename = ltrim($filename, '/');
        if ($filename === '' || str_contains($filename, '..') || preg_match(self::SAFE_FILENAME_PATTERN, $filename) !== 1) {
            return 'bundles/' . self::ASSET_DIR . '/icon-selector.js';
        }

        return 'bundles/' . self::ASSET_DIR . '/' . $filename;
    }
}
