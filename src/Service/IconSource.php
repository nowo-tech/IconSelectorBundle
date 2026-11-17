<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

/**
 * Where the icon picker reads its icon list and its SVG previews from (config key `nowo_icon_selector.source`).
 *
 * - {@see self::Iconify}: the browser loads collections, search results and SVGs from api.iconify.design
 *   (third-party requests from the user's browser; the 1.0–1.6 behaviour).
 * - {@see self::Bundle}: same-origin only. The list comes from the bundle icons endpoint (static list, or the
 *   server-side Iconify collections when use_iconify_collection is true) and the SVGs from the bundle SVG endpoint.
 * - {@see self::UxIconsLocal}: same-origin only. The list is the SVG files committed under the Symfony UX Icons
 *   directory (assets/icons by default), limited to the prefixes of the configured icon sets.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
enum IconSource: string
{
    case Iconify      = 'iconify';
    case Bundle       = 'bundle';
    case UxIconsLocal = 'ux_icons_local';

    /**
     * Resolves the effective source: the configured value, or the default derived from use_iconify_collection
     * (true = iconify, false = bundle) when none is configured. Unknown strings fall back to the same default.
     *
     * @param string|null $configured Configured source value (null = not configured)
     * @param bool $useIconifyCollection Value of nowo_icon_selector.use_iconify_collection
     */
    public static function resolve(?string $configured, bool $useIconifyCollection): self
    {
        $source = $configured !== null ? self::tryFrom($configured) : null;

        return $source ?? ($useIconifyCollection ? self::Iconify : self::Bundle);
    }

    /**
     * Whether the user's browser talks to the third-party Iconify API with this source.
     */
    public function usesBrowserIconify(): bool
    {
        return $this === self::Iconify;
    }
}
