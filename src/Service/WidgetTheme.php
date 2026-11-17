<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

/**
 * Look of the picker widget (configuration `theme`, field option `theme`).
 *
 * - "uikit": neutral markup (no Bootstrap classes) styled by icon-selector.css from the UiKit design tokens
 *   (--nowo-ui-*), with CSS system colours as fallbacks, so it follows light / dark mode (prefers-color-scheme and
 *   UiKit's data-theme) on any host.
 * - "bootstrap": the Bootstrap utility classes of 1.7 and earlier (form-control, border rounded shadow-sm bg-white ...),
 *   unchanged for Bootstrap hosts.
 * - "auto": "uikit" when nowo-tech/ui-kit-bundle (NowoUiKitBundle) is registered, else "bootstrap".
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
enum WidgetTheme: string
{
    case Auto      = 'auto';
    case UiKit     = 'uikit';
    case Bootstrap = 'bootstrap';

    /** Bundle name of nowo-tech/ui-kit-bundle in kernel.bundles. */
    public const UI_KIT_BUNDLE = 'NowoUiKitBundle';

    /**
     * Resolves a configured value to a concrete theme ("uikit" or "bootstrap").
     *
     * @param string|null $configured Configured value (null or "auto" = automatic; unknown values = automatic)
     * @param bool $uiKitInstalled Whether NowoUiKitBundle is registered in the kernel
     */
    public static function resolve(?string $configured, bool $uiKitInstalled): self
    {
        $theme = $configured !== null ? self::tryFrom($configured) : null;
        if ($theme === null || $theme === self::Auto) {
            return $uiKitInstalled ? self::UiKit : self::Bootstrap;
        }

        return $theme;
    }

    /**
     * Whether NowoUiKitBundle is in the kernel.bundles map.
     *
     * @param array<array-key, mixed> $bundles kernel.bundles parameter (name => class)
     */
    public static function uiKitIn(array $bundles): bool
    {
        return isset($bundles[self::UI_KIT_BUNDLE]);
    }
}
