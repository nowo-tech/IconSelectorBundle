<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;
use UnexpectedValueException;

use function count;
use function in_array;
use function is_dir;
use function preg_match;
use function sort;
use function str_replace;
use function strlen;
use function substr;

use const SORT_STRING;

/**
 * Lists the icons committed under the Symfony UX Icons directory (ux_icons.icon_dir, assets/icons by default).
 *
 * A file `<icon_dir>/tabler/home.svg` is the icon `tabler:home`; deeper folders add segments
 * (`flags/eu/es.svg` → `flags:eu:es`), exactly as UX Icons resolves local names. Files directly under the
 * directory have no prefix and are skipped: the picker stores `prefix:name` values. Segments must be lowercase
 * letters, digits and hyphens (the UX Icons name format); symlinks are not followed.
 *
 * The directory is read on every call: no state is kept between requests (FrankenPHP worker mode, kernel reset
 * false), and icons committed in a new deploy appear without a cache clear.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final readonly class LocalUxIconsScanner
{
    private const SEGMENT_PATTERN = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/D';

    /**
     * @param string $iconDir Absolute path of the UX Icons directory
     */
    public function __construct(
        private string $iconDir,
    ) {
    }

    /**
     * Returns the local icon identifiers, sorted, optionally limited to some prefixes.
     *
     * @param list<string>|null $prefixes Allowed prefixes (first path segment); null = every prefix
     *
     * @return list<string>
     */
    public function listIcons(?array $prefixes = null): array
    {
        if ($this->iconDir === '' || !is_dir($this->iconDir)) {
            return [];
        }

        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($this->iconDir, FilesystemIterator::SKIP_DOTS | FilesystemIterator::CURRENT_AS_FILEINFO),
            );
        } catch (UnexpectedValueException) {
            return [];
        }

        $root  = str_replace('\\', '/', $this->iconDir);
        $root  = rtrim($root, '/') . '/';
        $icons = [];
        /** @var SplFileInfo $file */
        foreach ($iterator as $file) {
            if (!$file->isFile() || $file->isLink() || $file->getExtension() !== 'svg') {
                continue;
            }
            $path = str_replace('\\', '/', $file->getPathname());
            if (!str_starts_with($path, $root)) {
                continue;
            }
            $id = $this->toIconId(substr($path, strlen($root), -4));
            if ($id === null) {
                continue;
            }
            if ($prefixes !== null && !in_array(explode(':', $id, 2)[0], $prefixes, true)) {
                continue;
            }
            $icons[] = $id;
        }
        sort($icons, SORT_STRING);

        return $icons;
    }

    /**
     * Turns a relative path without extension (tabler/home) into an icon id (tabler:home), or null when it has no
     * prefix or a segment is not a valid UX Icons name.
     */
    private function toIconId(string $relative): ?string
    {
        $segments = explode('/', $relative);
        if (count($segments) < 2) {
            return null;
        }
        foreach ($segments as $segment) {
            if (preg_match(self::SEGMENT_PATTERN, $segment) !== 1) {
                return null;
            }
        }

        return implode(':', $segments);
    }
}
