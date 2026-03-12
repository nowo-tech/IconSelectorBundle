<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

use Throwable;

use function in_array;

/**
 * Provides the list of available icon identifiers for the configured icon sets.
 *
 * Used by the API endpoint and can be used to validate submitted icon values.
 * Icon identifiers follow Symfony UX Icons / Iconify format: prefix:name
 * (e.g. "heroicons-outline:home", "heroicons-solid:user", "bi:house").
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final readonly class IconListProvider
{
    /**
     * Static list of common icons per set for the selector.
     * Used when use_iconify_collection is false or when the Iconify API fails.
     * IDs match Iconify/UX Icons naming so ux_icon() can resolve them.
     *
     * @var array<string, list<string>>
     */
    private const DEFAULT_ICONS = [
        'heroicons' => [
            'heroicons-outline:home',
            'heroicons-outline:user',
            'heroicons-outline:academic-cap',
            'heroicons-outline:cog-6-tooth',
            'heroicons-outline:arrow-right',
            'heroicons-outline:document-text',
            'heroicons-outline:folder',
            'heroicons-outline:chart-bar',
            'heroicons-outline:envelope',
            'heroicons-outline:magnifying-glass',
            'heroicons-outline:heart',
            'heroicons-outline:star',
            'heroicons-outline:plus-circle',
            'heroicons-outline:trash',
            'heroicons-outline:pencil',
            'heroicons-outline:calendar',
            'heroicons-outline:clock',
            'heroicons-outline:photo',
            'heroicons-outline:link',
            'heroicons-outline:arrow-down-tray',
            'heroicons-outline:archive',
            'heroicons-solid:home',
            'heroicons-solid:user',
            'heroicons-solid:cog-6-tooth',
        ],
        'bootstrap-icons' => [
            'bi:house',
            'bi:person',
            'bi:gear',
            'bi:arrow-right',
            'bi:file-text',
            'bi:folder',
            'bi:bar-chart',
            'bi:envelope',
            'bi:search',
            'bi:heart',
            'bi:star',
            'bi:plus-circle',
            'bi:trash',
            'bi:pencil',
            'bi:calendar',
            'bi:clock',
            'bi:image',
            'bi:link',
            'bi:download',
        ],
        'lucide' => [
            'lucide:home',
            'lucide:user',
            'lucide:settings',
            'lucide:arrow-right',
            'lucide:file-text',
            'lucide:folder',
            'lucide:bar-chart-3',
            'lucide:mail',
            'lucide:search',
            'lucide:heart',
            'lucide:star',
            'lucide:plus-circle',
            'lucide:trash-2',
            'lucide:pencil',
            'lucide:calendar',
            'lucide:clock',
            'lucide:image',
            'lucide:link',
            'lucide:download',
        ],
        'tabler' => [
            'tabler:home',
            'tabler:user',
            'tabler:settings',
            'tabler:arrow-right',
            'tabler:file-text',
            'tabler:folder',
            'tabler:chart-bar',
            'tabler:mail',
            'tabler:search',
            'tabler:heart',
            'tabler:star',
            'tabler:plus',
            'tabler:trash',
            'tabler:pencil',
            'tabler:calendar',
            'tabler:clock',
            'tabler:photo',
            'tabler:link',
            'tabler:download',
        ],
    ];

    /**
     * @param list<string> $iconSets Enabled icon set names (e.g. heroicons, bootstrap-icons)
     * @param bool $useIconifyCollection When true, use IconifyCollectionLoader to fetch full list from api.iconify.design (requires loader and symfony/http-client)
     * @param IconifyCollectionLoader|null $collectionLoader Loader for Iconify API collections (injected when use_iconify_collection is true)
     */
    public function __construct(
        private array $iconSets,
        private bool $useIconifyCollection = false,
        private ?IconifyCollectionLoader $collectionLoader = null,
    ) {
    }

    /**
     * Returns all available icon identifiers for the configured sets.
     *
     * @return list<string>
     */
    public function getIcons(): array
    {
        return $this->getIconsForSets($this->iconSets);
    }

    /**
     * Returns icon identifiers for the given set names only.
     * Use this to override which libraries a specific field uses (e.g. only heroicons).
     * When use_iconify_collection is true and the loader is available, returns the full list from the Iconify API; otherwise uses the static default list.
     *
     * @param list<string> $sets Icon set names (e.g. heroicons, bootstrap-icons)
     *
     * @return list<string>
     */
    public function getIconsForSets(array $sets): array
    {
        $icons = [];
        foreach ($sets as $set) {
            if ($this->useIconifyCollection && $this->collectionLoader instanceof IconifyCollectionLoader) {
                try {
                    foreach ($this->collectionLoader->getIconsForSet($set) as $id) {
                        $icons[] = $id;
                    }
                } catch (Throwable) {
                    $setIcons = self::DEFAULT_ICONS[$set] ?? [];
                    foreach ($setIcons as $id) {
                        $icons[] = $id;
                    }
                }
            } else {
                $setIcons = self::DEFAULT_ICONS[$set] ?? [];
                foreach ($setIcons as $id) {
                    $icons[] = $id;
                }
            }
        }

        return array_values(array_unique($icons));
    }

    /**
     * Returns icons grouped by set (for frontend display).
     *
     * @return array<string, list<string>>
     */
    public function getIconsBySet(): array
    {
        $bySet = [];
        foreach ($this->iconSets as $set) {
            $bySet[$set] = $this->getIconsForSets([$set]);
        }

        return $bySet;
    }

    /**
     * Checks whether the given icon identifier is available in the configured sets.
     *
     * @param string $iconId Icon ID (e.g. heroicons-outline:home)
     *
     * @return bool True if the icon is in the configured sets
     */
    public function isValidIcon(string $iconId): bool
    {
        return in_array($iconId, $this->getIcons(), true);
    }
}
