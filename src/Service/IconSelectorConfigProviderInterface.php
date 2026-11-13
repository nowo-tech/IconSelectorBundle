<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Service;

/**
 * Port: widget configuration served to the browser (Iconify base URL and the enabled sets).
 *
 * The bundle ships {@see IconSelectorConfigProvider} and aliases this interface to it; a host replaces the alias to
 * change what the config endpoint returns (for example a self-hosted Iconify API).
 */
interface IconSelectorConfigProviderInterface
{
    /**
     * @return array{iconify_base: string, sets: list<array{key: string, label: string, prefixes: list<string>}>, debug: bool}
     */
    public function getConfig(): array;
}
