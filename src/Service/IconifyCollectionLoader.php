<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

use function is_array;
use function is_string;

/**
 * Fetches the full list of icon names for Iconify API prefixes from api.iconify.design/collection.
 *
 * Used when nowo_icon_selector.use_iconify_collection is true so the selector shows all icons
 * of each configured library instead of the static default list.
 * Output format matches Symfony UX Icons / Iconify: prefix:name (e.g. "heroicons-outline:home", "bi:house").
 *
 * @see https://iconify.design/docs/api/collection.html
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final readonly class IconifyCollectionLoader
{
    private const API_ENDPOINT    = 'https://api.iconify.design';
    private const CACHE_TTL       = 86400; // 24 hours
    private const REQUEST_TIMEOUT = 15.0; // seconds per API call to avoid max execution time

    /**
     * Map bundle set name => list of Iconify API prefixes (e.g. heroicons-outline, bi).
     * Returned icon IDs use the same prefix so ux_icon() resolves them (e.g. heroicons-outline:home).
     *
     * @var array<string, list<string>>
     */
    private array $setMapping;

    /**
     * @param HttpClientInterface $httpClient HTTP client for Iconify API requests
     * @param CacheInterface $cache Cache for storing collection responses (24h TTL)
     * @param array<string, list<string>> $setMapping Optional map of set name to Iconify API prefixes; defaults to heroicons and bootstrap-icons
     */
    public function __construct(
        private HttpClientInterface $httpClient,
        private CacheInterface $cache,
        array $setMapping = [],
    ) {
        $this->setMapping = $setMapping !== [] ? $setMapping : $this->defaultSetMapping();
    }

    /**
     * Returns the default set name to prefixes mapping (heroicons and bootstrap-icons).
     *
     * @return array<string, list<string>> Map of set name to list of Iconify API prefixes
     */
    private function defaultSetMapping(): array
    {
        return [
            'heroicons'       => ['heroicons-outline', 'heroicons-solid'],
            'bootstrap-icons' => ['bi'],
        ];
    }

    /**
     * Returns all icon identifiers (prefix:name) for the given set name, in UX Icons / Iconify format.
     * If the set name is not in the mapping, it is used as a single Iconify API prefix.
     *
     * @param string $setName Configured set name (e.g. heroicons, lucide)
     *
     * @return list<string> List of icon IDs (e.g. heroicons-outline:home)
     */
    public function getIconsForSet(string $setName): array
    {
        $prefixes = $this->setMapping[$setName] ?? [$setName];

        $icons = [];
        foreach ($prefixes as $prefix) {
            foreach ($this->getIconsForPrefix($prefix) as $fullId) {
                $icons[] = $fullId;
            }
        }

        return array_values(array_unique($icons));
    }

    /**
     * Returns all icon identifiers (prefix:name) for the given Iconify API prefix.
     * Results are cached for 24 hours per prefix.
     *
     * @param string $prefix Iconify API prefix (e.g. heroicons-outline, bi)
     *
     * @return list<string> List of icon IDs for this prefix
     */
    public function getIconsForPrefix(string $prefix): array
    {
        $cacheKey = 'nowo_icon_selector.iconify.' . preg_replace('/[^a-z0-9_-]/i', '_', $prefix);

        return $this->cache->get($cacheKey, function () use ($prefix): array {
            $response = $this->httpClient->request('GET', self::API_ENDPOINT . '/collection', [
                'query'   => ['prefix' => $prefix],
                'timeout' => self::REQUEST_TIMEOUT,
            ]);

            if ($response->getStatusCode() !== 200) {
                return [];
            }

            $data  = $response->toArray();
            $names = [];

            if (isset($data['uncategorized']) && is_array($data['uncategorized'])) {
                foreach ($data['uncategorized'] as $name) {
                    if (is_string($name)) {
                        $names[] = $prefix . ':' . $name;
                    }
                }
            }

            if (isset($data['categories']) && is_array($data['categories'])) {
                foreach ($data['categories'] as $categoryIcons) {
                    if (!is_array($categoryIcons)) {
                        continue;
                    }
                    foreach ($categoryIcons as $name) {
                        if (is_string($name)) {
                            $names[] = $prefix . ':' . $name;
                        }
                    }
                }
            }

            return array_values(array_unique($names));
        }, self::CACHE_TTL);
    }
}
