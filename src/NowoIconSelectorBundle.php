<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle;

use Symfony\Component\HttpKernel\Bundle\Bundle;

/**
 * Icon selector form type bundle.
 *
 * Provides a form widget to select an icon (grid, search, or dropdown mode).
 * Selected value is stored as an icon identifier string (e.g. heroicons-outline:home).
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final class NowoIconSelectorBundle extends Bundle
{
}
