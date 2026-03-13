<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Controller\Api;

use Nowo\IconSelectorBundle\Service\IconSelectorConfigProvider;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * API endpoint that returns widget config for the icon selector (Iconify-only, 100% front).
 *
 * The frontend uses this once to get iconify_base and the list of sets (key, label, prefixes),
 * then fetches collection and icon data directly from api.iconify.design.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final readonly class IconConfigController
{
    public function __construct(
        private IconSelectorConfigProvider $configProvider,
    ) {
    }

    /**
     * Returns the widget configuration as JSON (iconify_base and sets with prefixes).
     *
     * @return JsonResponse JSON object with keys: iconify_base, sets
     */
    #[Route(path: '/api/icon-selector/config', name: 'nowo_icon_selector_api_config', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        return new JsonResponse($this->configProvider->getConfig());
    }
}
