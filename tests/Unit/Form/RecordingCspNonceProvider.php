<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Form;

/**
 * Test double for NelmioSecurityBundle's CSP listener: counts getNonce() calls (asking it creates a nonce).
 */
final class RecordingCspNonceProvider
{
    public int $calls = 0;

    public function __construct(private readonly string $nonce)
    {
    }

    public function getNonce(string $usage): string
    {
        ++$this->calls;

        return $usage === 'style' ? $this->nonce : 'other';
    }
}
