<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Emoji;

use function strlen;

/**
 * Pure helpers for stored icon values: "prefix:name" for icons and "emoji:<grapheme>" for emoji.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final class IconValue
{
    /** Prefix of stored emoji values (e.g. "emoji:🚀"). */
    public const EMOJI_PREFIX = 'emoji:';

    /** Upper bound (bytes) of the grapheme part; the longest RGI sequence is well below it. */
    public const MAX_EMOJI_BYTES = 64;

    private function __construct()
    {
    }

    /**
     * Whether the stored value uses the emoji prefix (says nothing about validity).
     */
    public static function isEmoji(?string $value): bool
    {
        return $value !== null && str_starts_with($value, self::EMOJI_PREFIX);
    }

    /**
     * Returns the grapheme part of an "emoji:" value, or null for non-emoji / oversized values.
     */
    public static function emojiOf(?string $value): ?string
    {
        if (!self::isEmoji($value)) {
            return null;
        }
        $emoji = substr((string) $value, strlen(self::EMOJI_PREFIX));

        return $emoji === '' || strlen($emoji) > self::MAX_EMOJI_BYTES ? null : $emoji;
    }

    /**
     * Builds the stored value for an emoji grapheme.
     */
    public static function fromEmoji(string $emoji): string
    {
        return self::EMOJI_PREFIX . $emoji;
    }
}
