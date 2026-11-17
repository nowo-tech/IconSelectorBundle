<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

/**
 * Port: widget configuration served to the browser (icon source, Iconify base URL and the enabled sets).
 * The browser widget only contacts the Iconify base URL when `source` is `iconify` and `iconify_base` is a non-empty
 * string; any other shape keeps it on the bundle's same-origin endpoints.
 *
 * The bundle ships {@see IconSelectorConfigProvider} and aliases this interface to it; a host replaces the alias to
 * change what the config endpoint returns (for example a self-hosted Iconify API).
 */
interface IconSelectorConfigProviderInterface
{
    /**
     * @return array{source: string, iconify_base: string|null, sets: list<array{key: string, label: string, prefixes: list<string>}>, debug: bool}
     */
    public function getConfig(): array;
}
