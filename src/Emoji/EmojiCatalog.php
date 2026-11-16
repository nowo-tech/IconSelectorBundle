<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Emoji;

use function is_array;
use function is_string;
use function strlen;

use const ARRAY_FILTER_USE_BOTH;

/**
 * Bundled emoji catalogue (Unicode emoji-test.txt + CLDR names, see src/Resources/emoji/LICENSE-UNICODE.txt).
 *
 * The data file is a plain PHP array (OPcache keeps it in shared memory) read once in the constructor into readonly
 * properties: no per-request state, safe for FrankenPHP worker mode with kernel reset disabled.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final readonly class EmojiCatalog implements EmojiCatalogInterface
{
    /** Default data file shipped with the bundle. */
    public const DEFAULT_DATA_FILE = __DIR__ . '/../Resources/emoji/emoji-data.php';

    /** @var array<string, string> Emoji grapheme => CLDR short name */
    private array $emoji;

    private string $version;

    /**
     * @param string $dataFile PHP file returning ['emoji_version' => string, 'emoji' => array<string, string>]
     */
    public function __construct(string $dataFile = self::DEFAULT_DATA_FILE)
    {
        /** @var mixed $data */
        $data          = require $dataFile;
        $emoji         = is_array($data) && is_array($data['emoji'] ?? null) ? $data['emoji'] : [];
        $this->emoji   = array_filter($emoji, static fn ($name, $key): bool => is_string($name) && is_string($key), ARRAY_FILTER_USE_BOTH);
        $this->version = is_array($data) && is_string($data['emoji_version'] ?? null) ? $data['emoji_version'] : '';
    }

    public function isValid(string $emoji): bool
    {
        return $emoji !== '' && strlen($emoji) <= IconValue::MAX_EMOJI_BYTES && isset($this->emoji[$emoji]);
    }

    public function getName(string $emoji): ?string
    {
        return $this->isValid($emoji) ? $this->emoji[$emoji] : null;
    }

    public function getVersion(): string
    {
        return $this->version;
    }
}
