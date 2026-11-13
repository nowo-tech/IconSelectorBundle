<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

/**
 * Port: the catalogue of icon identifiers the selector offers and the API endpoints expose.
 *
 * The bundle ships {@see IconListProvider} (static lists, optionally the full Iconify collections) and aliases this
 * interface to it. A host replaces the alias to serve its own catalogue (a database table, a curated list, a
 * per-tenant subset); the form type and the icon API endpoints read through this port only.
 * Identifiers follow the Iconify format `prefix:name` (for example `heroicons-outline:home`).
 */
interface IconCatalogInterface
{
    /**
     * Returns all available icon identifiers for the configured sets.
     *
     * @return list<string>
     */
    public function getIcons(): array;

    /**
     * Returns icon identifiers for the given set names only.
     *
     * @param list<string> $sets Icon set names (for example heroicons, bootstrap-icons)
     *
     * @return list<string>
     */
    public function getIconsForSets(array $sets): array;

    /**
     * Returns icons grouped by set name.
     *
     * @return array<string, list<string>>
     */
    public function getIconsBySet(): array;

    /**
     * Whether the identifier is available in the catalogue.
     *
     * @param string $iconId Icon id (for example heroicons-outline:home)
     */
    public function isValidIcon(string $iconId): bool;
}
