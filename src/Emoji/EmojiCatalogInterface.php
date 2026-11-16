<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Emoji;

/**
 * Port: the set of RGI emoji the bundle accepts and their names.
 *
 * The bundle ships {@see EmojiCatalog} (bundled Unicode data, loaded once, immutable) and aliases this interface to
 * it. A host replacing the alias must stay at least as strict: only single, recommended-for-general-interchange emoji
 * sequences may be reported as valid, because the rendering helper prints accepted values as text.
 */
interface EmojiCatalogInterface
{
    /**
     * Whether $emoji is exactly one RGI emoji (fully- or minimally-qualified sequence; components excluded).
     *
     * @param string $emoji The bare grapheme (without the "emoji:" prefix)
     */
    public function isValid(string $emoji): bool;

    /**
     * CLDR short name of $emoji (e.g. "rocket"), or null when it is not a valid emoji.
     *
     * @param string $emoji The bare grapheme (without the "emoji:" prefix)
     */
    public function getName(string $emoji): ?string;

    /**
     * Version of the emoji data (Unicode Emoji version, e.g. "18.0").
     */
    public function getVersion(): string;
}
