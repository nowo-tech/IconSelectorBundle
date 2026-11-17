<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

/**
 * Provides the widget config served by GET /api/icon-selector/config.
 *
 * Returns the effective icon source, the enabled "sets" (key, label, prefixes) and the Iconify base URL. The base
 * URL is only returned with source iconify: with bundle or ux_icons_local it is null, and the browser widget then
 * reads the icon list and the SVGs from the bundle's same-origin endpoints only (no third-party request).
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final readonly class IconSelectorConfigProvider implements IconSelectorConfigProviderInterface
{
    private const ICONIFY_BASE = 'https://api.iconify.design';

    /**
     * Optional display labels per set key (fallback: humanized key).
     *
     * @var array<string, string>
     */
    private const SET_LABELS = [
        'heroicons'       => 'Heroicons',
        'bootstrap-icons' => 'Bootstrap Icons',
    ];

    /**
     * @param list<string> $iconSets Configured icon set keys (e.g. heroicons, bootstrap-icons)
     * @param bool $debug When true, frontend shows all console logs; when false, only "script loaded"
     * @param string $source Effective icon source (see {@see IconSource}); only iconify exposes the Iconify base URL
     */
    public function __construct(
        private array $iconSets = [],
        private bool $debug = false,
        private string $source = 'bundle',
    ) {
    }

    /**
     * Returns config for the frontend widget: source, Iconify base URL (null unless source is iconify) and sets.
     *
     * @return array{source: string, iconify_base: string|null, sets: list<array{key: string, label: string, prefixes: list<string>}>, debug: bool}
     */
    public function getConfig(): array
    {
        $source = IconSource::tryFrom($this->source) ?? IconSource::Bundle;
        $sets   = [];
        foreach ($this->iconSets as $key) {
            $prefixes = IconSetPrefixes::forSet($key);
            $sets[]   = [
                'key'      => $key,
                'label'    => self::SET_LABELS[$key] ?? $this->humanize($key),
                'prefixes' => $prefixes,
            ];
        }

        return [
            'source'       => $source->value,
            'iconify_base' => $source->usesBrowserIconify() ? self::ICONIFY_BASE : null,
            'sets'         => $sets,
            'debug'        => $this->debug,
        ];
    }

    /**
     * Converts a set key to a human-readable label (e.g. "bootstrap-icons" → "Bootstrap Icons").
     *
     * @param string $key Set key with possible hyphens
     *
     * @return string Title-cased label
     */
    private function humanize(string $key): string
    {
        $out = str_replace('-', ' ', $key);

        return ucwords($out);
    }
}
