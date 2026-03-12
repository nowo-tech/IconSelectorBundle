<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

/**
 * Provides widget config for the icon selector when using Iconify from the frontend.
 *
 * Returns iconify_base URL and a list of "sets" (key, label, prefixes) so the browser
 * can fetch collection and icon data directly from api.iconify.design.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final readonly class IconSelectorConfigProvider
{
    private const ICONIFY_BASE = 'https://api.iconify.design';

    /**
     * Default mapping: bundle set key => Iconify API prefixes.
     * Same as IconifyCollectionLoader so the frontend and backend stay in sync.
     *
     * @var array<string, list<string>>
     */
    private const DEFAULT_SET_PREFIXES = [
        'heroicons'       => ['heroicons-outline', 'heroicons-solid'],
        'bootstrap-icons' => ['bi'],
    ];

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
     */
    public function __construct(
        private array $iconSets = [],
    ) {
    }

    /**
     * Returns config for the frontend widget: iconify base URL and sets (key, label, prefixes).
     *
     * @return array{iconify_base: string, sets: list<array{key: string, label: string, prefixes: list<string>}>}
     */
    public function getConfig(): array
    {
        $sets = [];
        foreach ($this->iconSets as $key) {
            $prefixes = self::DEFAULT_SET_PREFIXES[$key] ?? [$key];
            $sets[]   = [
                'key'      => $key,
                'label'    => self::SET_LABELS[$key] ?? $this->humanize($key),
                'prefixes' => $prefixes,
            ];
        }

        return [
            'iconify_base' => self::ICONIFY_BASE,
            'sets'         => $sets,
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
