<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Form\ChoiceLoader;

use Symfony\Component\Form\ChoiceList\Loader\AbstractChoiceLoader;
use Symfony\UX\Icons\IconRendererInterface;
use Throwable;

/**
 * Choice loader that accepts icon IDs (prefix:name) from the base list and also
 * any submitted value that matches the format and exists (verified via backend when possible).
 *
 * When IconRendererInterface is provided, values not in the base list are checked by
 * attempting to render the icon; only icons that render successfully are accepted.
 * When no renderer is available, any value with format prefix:name is accepted.
 */
final class IconChoiceLoader extends AbstractChoiceLoader
{
    /**
     * @param array<string, string> $choices Map of icon ID (value) to label
     * @param IconRendererInterface|null $iconRenderer Optional UX Icons renderer to verify icon existence (e.g. Iconify)
     */
    public function __construct(
        private readonly array $choices,
        private readonly ?IconRendererInterface $iconRenderer = null,
    ) {
    }

    /**
     * @return iterable<string> Icon IDs (choices)
     */
    protected function loadChoices(): iterable
    {
        return array_keys($this->choices);
    }

    /**
     * Accept values that match the icon ID format (prefix:name) even if not in the base list.
     *
     * @param array<int|string, string> $values
     * @param callable|null $value
     *
     * @return array<int|string, string>
     */
    protected function doLoadChoicesForValues(array $values, ?callable $value): array
    {
        $fromList = parent::doLoadChoicesForValues($values, $value);
        $result   = $fromList;

        foreach ($values as $key => $submitted) {
            if ((string) $submitted === '') {
                continue;
            }
            if (isset($result[$key])) {
                continue;
            }
            if ($this->iconExists((string) $submitted)) {
                $result[$key] = (string) $submitted;
            }
        }

        return $result;
    }

    /**
     * Returns whether the icon ID is valid (format) and exists when a renderer is available.
     */
    private function iconExists(string $id): bool
    {
        $parts = explode(':', $id, 2);
        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
            return false;
        }

        if ($this->iconRenderer === null) {
            return true;
        }

        try {
            $svg = $this->iconRenderer->renderIcon($id, []);

            return $svg !== '' && trim($svg) !== '';
        } catch (Throwable) {
            return false;
        }
    }
}
