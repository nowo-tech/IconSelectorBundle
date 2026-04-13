<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit;

use Nowo\IconSelectorBundle\NowoIconSelectorBundle;
use PHPUnit\Framework\TestCase;

/**
 * Smoke test for the bundle class registration.
 *
 * @covers \Nowo\IconSelectorBundle\NowoIconSelectorBundle
 */
final class NowoIconSelectorBundleTest extends TestCase
{
    /** Asserts the bundle can be instantiated and is of the expected type. */
    public function testBundleCanBeInstantiated(): void
    {
        $bundle = new NowoIconSelectorBundle();
        /* @phpstan-ignore staticMethod.alreadyNarrowedType (ensures bundle type) */
        self::assertInstanceOf(NowoIconSelectorBundle::class, $bundle);
    }
}
