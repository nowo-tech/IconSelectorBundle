<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

use function array_unique;
use function array_values;

/**
 * Maps a configured icon set key to the icon prefixes it covers (for example heroicons → heroicons-outline and
 * heroicons-solid, bootstrap-icons → bi). A key without an entry is its own prefix (tabler → tabler).
 * Pure, stateless helper shared by the config provider and the local UX Icons catalogue.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final class IconSetPrefixes
{
    /** @var array<string, list<string>> */
    private const MAP = [
        'heroicons'       => ['heroicons-outline', 'heroicons-solid'],
        'bootstrap-icons' => ['bi'],
    ];

    /**
     * Returns the icon prefixes of one set key.
     *
     * @param string $set Icon set key (for example heroicons, tabler)
     *
     * @return list<string>
     */
    public static function forSet(string $set): array
    {
        return self::MAP[$set] ?? [$set];
    }

    /**
     * Returns the icon prefixes of several set keys (unique, in order).
     *
     * @param list<string> $sets Icon set keys
     *
     * @return list<string>
     */
    public static function forSets(array $sets): array
    {
        $prefixes = [];
        foreach ($sets as $set) {
            foreach (self::forSet($set) as $prefix) {
                $prefixes[] = $prefix;
            }
        }

        return array_values(array_unique($prefixes));
    }
}
