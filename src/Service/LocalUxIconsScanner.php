<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;
use UnexpectedValueException;

use function array_filter;
use function array_unique;
use function array_values;
use function count;
use function is_dir;
use function is_link;
use function ksort;
use function preg_match;
use function scandir;
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
        $icons = [];
        foreach ($this->listIconsByPrefix($prefixes) as $ids) {
            foreach ($ids as $id) {
                $icons[] = $id;
            }
        }
        sort($icons, SORT_STRING);

        return $icons;
    }

    /**
     * Returns the local icon identifiers grouped by prefix, each list sorted. With a prefix list only
     * `<icon_dir>/<prefix>/` is walked for each valid prefix (a real directory, not a symlink); unreadable
     * subdirectories are skipped instead of failing the whole listing.
     *
     * @param list<string>|null $prefixes Allowed prefixes; null = every first-level directory
     *
     * @return array<string, list<string>> Prefix => icon ids (prefixes without icons are omitted)
     */
    public function listIconsByPrefix(?array $prefixes = null): array
    {
        if ($this->iconDir === '' || !is_dir($this->iconDir)) {
            return [];
        }
        $root = rtrim(str_replace('\\', '/', $this->iconDir), '/');

        $prefixes ??= $this->firstLevelDirectories($root);
        $byPrefix = [];
        foreach (array_unique($prefixes) as $prefix) {
            if (preg_match(self::SEGMENT_PATTERN, $prefix) !== 1) {
                continue;
            }
            $dir = $root . '/' . $prefix;
            if (!is_dir($dir) || is_link($dir)) {
                continue;
            }
            $ids = $this->walk($dir, $prefix);
            if ($ids !== []) {
                sort($ids, SORT_STRING);
                $byPrefix[$prefix] = $ids;
            }
        }
        ksort($byPrefix, SORT_STRING);

        return $byPrefix;
    }

    /**
     * Names of the first-level directories of the icon directory (candidate prefixes).
     *
     * @return list<string>
     */
    private function firstLevelDirectories(string $root): array
    {
        $names = scandir($root);

        return $names === false ? [] : array_values(array_filter(
            $names,
            static fn (string $name): bool => $name !== '.' && $name !== '..' && is_dir($root . '/' . $name),
        ));
    }

    /**
     * Walks one prefix directory and returns its icon ids. Unreadable subdirectories are skipped
     * (CATCH_GET_CHILD); an unreadable prefix directory yields no icons.
     *
     * @return list<string>
     */
    private function walk(string $dir, string $prefix): array
    {
        $ids = [];
        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS | FilesystemIterator::CURRENT_AS_FILEINFO),
                RecursiveIteratorIterator::LEAVES_ONLY,
                RecursiveIteratorIterator::CATCH_GET_CHILD,
            );
            /** @var SplFileInfo $file */
            foreach ($iterator as $file) {
                if (!$file->isFile() || $file->isLink() || $file->getExtension() !== 'svg') {
                    continue;
                }
                $path = str_replace('\\', '/', $file->getPathname());
                $id   = $this->toIconId($prefix . '/' . substr($path, strlen($dir) + 1, -4));
                if ($id !== null) {
                    $ids[] = $id;
                }
            }
        } catch (UnexpectedValueException) {
            return [];
        }

        return $ids;
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
