<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Controller\Api;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\UX\Icons\IconRendererInterface;
use Throwable;

use function array_slice;
use function is_array;
use function is_string;

/**
 * API endpoint that returns SVG markup for multiple icon IDs in one response.
 *
 * Uses Symfony UX Icons (IconRendererInterface) so icons are resolved server-side
 * without the browser making individual requests. Use this to batch-load SVGs
 * for the icon selector grid or Tom Select options.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final readonly class IconSvgController
{
    private const MAX_IDS = 500;

    /**
     * @param IconRendererInterface $iconRenderer UX Icons renderer used to resolve icon IDs to SVG markup
     */
    public function __construct(
        private IconRendererInterface $iconRenderer,
    ) {
    }

    /**
     * Returns a JSON object mapping icon IDs to their SVG markup.
     *
     * GET /api/icon-selector/icons/svg?ids=id1,id2,id3
     * or POST with JSON body: {"ids": ["id1", "id2"]}
     *
     * Response: {"id1": "<svg>...</svg>", "id2": "<svg>...</svg>"}
     * Failed or unknown icons are omitted or have an empty string.
     *
     * @param Request $request GET with query "ids" (comma-separated) or POST with JSON body {"ids": ["id1", "id2"]}
     *
     * @return JsonResponse Map of icon ID to SVG markup string
     */
    #[Route(path: '/api/icon-selector/icons/svg', name: 'nowo_icon_selector_api_icons_svg', methods: ['GET', 'POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        $ids = $this->getIdsFromRequest($request);
        if ($ids === []) {
            return new JsonResponse([], Response::HTTP_OK);
        }

        $ids  = array_slice(array_unique($ids), 0, self::MAX_IDS);
        $svgs = [];

        foreach ($ids as $id) {
            if ($id === '') {
                continue;
            }
            try {
                $svgs[$id] = $this->iconRenderer->renderIcon($id, [
                    'class' => 'icon-selector-svg',
                    'style' => 'width:1.25rem;height:1.25rem;fill:currentColor;',
                ]);
            } catch (Throwable) {
                $svgs[$id] = '';
            }
        }

        return new JsonResponse($svgs);
    }

    /**
     * Extracts and normalizes icon IDs from the request (POST JSON or GET query).
     *
     * @param Request $request Current HTTP request
     *
     * @return list<string> List of non-empty trimmed icon identifiers
     */
    private function getIdsFromRequest(Request $request): array
    {
        if ($request->getMethod() === 'POST') {
            $contentType = $request->headers->get('Content-Type', '');
            if (str_contains((string) $contentType, 'application/json')) {
                $data = $request->toArray();
                $ids  = $data['ids'] ?? [];

                return is_array($ids) ? array_values(array_filter($ids, is_string(...))) : [];
            }
        }

        $idsParam = (string) $request->query->get('ids', '');

        return array_values(array_filter(array_map(trim(...), explode(',', $idsParam))));
    }
}
