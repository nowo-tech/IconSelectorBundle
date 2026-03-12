<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Controller\Api;

use Nowo\IconSelectorBundle\Service\IconListProvider;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * API endpoint that returns the list of available icons for the icon selector.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final readonly class IconListController
{
    /**
     * @param IconListProvider $iconListProvider Provider of icon identifiers for configured sets
     */
    public function __construct(
        private IconListProvider $iconListProvider,
    ) {
    }

    /**
     * Returns a JSON response with flat icon list and icons grouped by set.
     *
     * @return JsonResponse Keys: icons (list), icons_by_set (map of set name to list of icon IDs)
     */
    #[Route(path: '/api/icon-selector/icons', name: 'nowo_icon_selector_api_icons', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        return new JsonResponse([
            'icons'        => $this->iconListProvider->getIcons(),
            'icons_by_set' => $this->iconListProvider->getIconsBySet(),
        ]);
    }
}
